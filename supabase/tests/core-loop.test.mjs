/**
 * Core-loop integration test, executed against real Postgres (PGlite).
 *
 * Walks the whole documented happy path at the data layer:
 *   sign up (org + Owner) → create folder → upload asset (+ initial version)
 *   → tag it → search for it → create a share link → resolve that link
 *   → revoke it and confirm access stops.
 *
 * This is as far as the loop can be verified without a live Supabase project:
 * everything here is real SQL under real RLS, but the HTTP layer, Supabase Auth,
 * Storage uploads and sharp thumbnail generation are NOT exercised. See memory.md
 * for the full list of what remains unverified against live infrastructure.
 *
 * Run: node supabase/tests/core-loop.test.mjs
 */
import {
  asUser,
  asUserCommitted,
  check,
  createTestDb,
  expectDenied,
  section,
  summarize,
} from './harness.mjs'

const db = await createTestDb([
  '0001_initial_schema.sql',
  '0002_rls_policies.sql',
  '0004_search.sql',
])

/* ---------------- 1. Sign up: organization + Owner ---------------- */
// Mirrors signUpAction, which runs service-role because no membership row
// exists yet to authorise against.

section('Core loop 1/8 — sign up creates an organization and its Owner')

const orgId = (
  await db.query(
    `insert into organizations (name, plan) values ('Northwind Brand Studio','trial') returning id`
  )
).rows[0].id

const ownerAuthId = (
  await db.query(`insert into auth.users (email) values ('owner@northwind.com') returning id`)
).rows[0].id

await db.query(
  `insert into users (id, organization_id, full_name, email, role, status)
   values ($1,$2,'Alex Moreau','owner@northwind.com','owner','active')`,
  [ownerAuthId, orgId]
)

check('organization created', Boolean(orgId))
const ownerRow = (
  await db.query(`select role, status from users where id = $1`, [ownerAuthId])
).rows[0]
check('first user is an active Owner', ownerRow.role === 'owner' && ownerRow.status === 'active')

/* ------------------------- 2. Create a folder ------------------------- */

section('Core loop 2/8 — Owner creates a folder')

let folderId
await asUserCommitted(db, ownerAuthId, async () => {
  const { rows } = await db.query(
    `insert into folders (organization_id, name, created_by) values ($1,'Brand Assets',$2) returning id`,
    [orgId, ownerAuthId]
  )
  folderId = rows[0].id
  check('folder created under the caller’s own session (RLS allows)', Boolean(folderId))
})

/* ---------------- 3. Upload an asset + its initial version ---------------- */
// Mirrors the PUT /api/upload completion step.

section('Core loop 3/8 — upload creates an asset and an initial version')

let assetId
await asUserCommitted(db, ownerAuthId, async () => {
  const objectPath = `org/${orgId}/assets/PLACEHOLDER/v1/brand-logo.png`
  const { rows } = await db.query(
    `insert into assets
       (organization_id, folder_id, filename, file_type, file_size_bytes, r2_key,
        current_version, status, uploaded_by, metadata)
     values ($1,$2,'brand-logo.png','image/png',248000,$3,1,'active',$4,'{}'::jsonb)
     returning id`,
    [orgId, folderId, objectPath, ownerAuthId]
  )
  assetId = rows[0].id

  const v = await db.query(
    `insert into asset_versions (asset_id, version_number, r2_key, file_size_bytes, uploaded_by)
     values ($1,1,$2,248000,$3)`,
    [assetId, objectPath, ownerAuthId]
  )

  check('assets row created', Boolean(assetId))
  check('initial asset_versions row created', v.affectedRows === 1)
})

/* ------------------------------ 4. Tag it ------------------------------ */

section('Core loop 4/8 — tag the asset')

let tagId
await asUserCommitted(db, ownerAuthId, async () => {
  const { rows } = await db.query(
    `insert into tags (organization_id, name) values ($1,'brand-approved') returning id`,
    [orgId]
  )
  tagId = rows[0].id
  const link = await db.query(
    `insert into asset_tags (asset_id, tag_id) values ($1,$2)`,
    [assetId, tagId]
  )
  check('org tag created', Boolean(tagId))
  check('tag attached to the asset', link.affectedRows === 1)
})

/* ---------------------------- 5. Search for it ---------------------------- */

section('Core loop 5/8 — search finds it by filename, tag and metadata')

await asUserCommitted(db, ownerAuthId, async () => {
  const byName = await db.query(
    `select filename from search_assets('brand-logo',null,null,null,null,null,null,null)`
  )
  check('found by filename', byName.rows.length === 1)

  const byTag = await db.query(
    `select filename from search_assets('brand-approved',null,null,null,null,null,null,null)`
  )
  check('found by tag name', byTag.rows.length === 1)

  const byTagFilter = await db.query(
    `select filename from search_assets(null,null,null,ARRAY[$1]::uuid[],null,null,null,null)`,
    [tagId]
  )
  check('found by tag filter', byTagFilter.rows.length === 1)

  const byKind = await db.query(
    `select filename from search_assets(null,null,ARRAY['image']::text[],null,null,null,null,null)`
  )
  check('found by file-kind filter', byKind.rows.length === 1)

  // Metadata search, after setting a custom field value.
  await db.query(
    `update assets set metadata = '{"campaign":"Spring Launch"}'::jsonb where id = $1`,
    [assetId]
  )
  const byMeta = await db.query(
    `select filename from search_assets('Spring Launch',null,null,null,null,null,null,null)`
  )
  check('found by metadata value', byMeta.rows.length === 1)

  const miss = await db.query(
    `select filename from search_assets('nonexistent-xyz',null,null,null,null,null,null,null)`
  )
  check('a non-matching query returns nothing', miss.rows.length === 0)
})

/* -------------------------- 6. Create a share link -------------------------- */

section('Core loop 6/8 — create a share link')

let shareId
const shareToken = 'Zm9vYmFyYmF6cXV4.abcdef0123456789'
await asUserCommitted(db, ownerAuthId, async () => {
  const { rows } = await db.query(
    `insert into share_links
       (organization_id, token, asset_id, allow_download, expires_at, created_by)
     values ($1,$2,$3,true, now() + interval '14 days', $4)
     returning id`,
    [orgId, shareToken, assetId, ownerAuthId]
  )
  shareId = rows[0].id
  check('share link created with a future expiry', Boolean(shareId))
})

/* ------------------------- 7. Resolve the share link ------------------------- */
// Mirrors resolveShareLink(), which runs service-role because the visitor has no
// session at all — hence no asUser() wrapper here.

section('Core loop 7/8 — the public portal resolves the link')

const resolved = await db.query(
  `select sl.id, sl.allow_download, sl.expires_at, sl.revoked_at,
          o.name as org_name, o.brand_primary_color,
          a.filename, a.r2_key
   from share_links sl
   join organizations o on o.id = sl.organization_id
   join assets a on a.id = sl.asset_id
   where sl.token = $1
     and sl.revoked_at is null
     and sl.expires_at > now()
     and a.status = 'active'`,
  [shareToken]
)
check('valid token resolves to exactly one asset', resolved.rows.length === 1)
check(
  'resolution carries the org branding for the portal',
  resolved.rows[0]?.org_name === 'Northwind Brand Studio'
)
check('downloads permitted as configured', resolved.rows[0]?.allow_download === true)

// The anon role must not be able to reach share_links directly.
await asUser(
  db,
  null,
  async () => {
    const { rows } = await db.query(`select id from share_links where token = $1`, [shareToken])
    check('anon cannot read share_links directly (service-role only)', rows.length === 0)
  },
  'anon'
)

/* ---------------------- 8. Revoke and confirm access ends ---------------------- */

section('Core loop 8/8 — revoking the link stops access immediately')

await asUserCommitted(db, ownerAuthId, async () => {
  const revoked = await db.query(
    `update share_links set revoked_at = now() where id = $1`,
    [shareId]
  )
  check('Owner can revoke', revoked.affectedRows === 1)

  // Same resolution query the portal runs, inside this transaction.
  const after = await db.query(
    `select sl.id from share_links sl
     where sl.token = $1 and sl.revoked_at is null and sl.expires_at > now()`,
    [shareToken]
  )
  check('a revoked link no longer resolves', after.rows.length === 0)
})

// An already-expired link must not resolve either.
await db.query(
  `insert into share_links (organization_id, token, asset_id, expires_at, created_by)
   values ($1,'ZXhwaXJlZHRva2Vu.fedcba9876543210',$2, now() - interval '1 day', $3)`,
  [orgId, assetId, ownerAuthId]
)
const expired = await db.query(
  `select id from share_links
   where token = 'ZXhwaXJlZHRva2Vu.fedcba9876543210'
     and revoked_at is null and expires_at > now()`
)
check('an expired link does not resolve', expired.rows.length === 0)

/* ------------------- Version history, exercised end to end ------------------- */

section('Version history — replace file keeps the prior version restorable')

await asUserCommitted(db, ownerAuthId, async () => {
  const v2Path = `org/${orgId}/assets/${assetId}/v2/brand-logo.png`
  await db.query(
    `insert into asset_versions (asset_id, version_number, r2_key, file_size_bytes, uploaded_by)
     values ($1,2,$2,301000,$3)`,
    [assetId, v2Path, ownerAuthId]
  )
  await db.query(
    `update assets set r2_key = $1, current_version = 2, file_size_bytes = 301000 where id = $2`,
    [v2Path, assetId]
  )

  const versions = await db.query(
    `select version_number from asset_versions where asset_id = $1 order by version_number desc`,
    [assetId]
  )
  check('both versions are retained', versions.rows.length === 2)
  check(
    'newest version is first (reverse-chronological)',
    versions.rows[0].version_number === 2
  )

  const current = await db.query(`select current_version from assets where id = $1`, [assetId])
  check('current_version incremented', current.rows[0].current_version === 2)
})

// expectDenied relies on SAVEPOINT, so it runs inside a transaction-wrapped block.
await asUser(db, ownerAuthId, async () => {
  await expectDenied(db, 'the prior version row cannot be tampered with', () =>
    db.query(`update asset_versions set r2_key = 'x' where asset_id = $1 and version_number = 1`, [
      assetId,
    ])
  )
})

section('Soft delete — deleted assets leave search and the portal')

await asUserCommitted(db, ownerAuthId, async () => {
  await db.query(`update assets set status = 'deleted' where id = $1`, [assetId])
  const found = await db.query(
    `select filename from search_assets('brand-logo',null,null,null,null,null,null,null)`
  )
  check('a soft-deleted asset disappears from search', found.rows.length === 0)
  const stillThere = await db.query(`select id from assets where id = $1`, [assetId])
  check('...but the row and its history are preserved', stillThere.rows.length === 1)
})

process.exit(summarize())
