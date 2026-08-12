/**
 * TICKET-003 verification — executed against real Postgres (PGlite).
 *
 * Acceptance criteria under test:
 *  - RLS enabled on every org-scoped table
 *  - a user from Org A cannot read or write any row belonging to Org B
 *  - a Viewer cannot insert/update/delete assets/folders/tags/share_links even
 *    via a direct query (i.e. bypassing the UI entirely)
 *
 * Run: node supabase/tests/rls.test.mjs
 */
import { asUser, check, createTestDb, expectDenied, section, summarize } from './harness.mjs'

const db = await createTestDb(['0001_initial_schema.sql', '0002_rls_policies.sql'])

/* --------------------------------- seed ---------------------------------- */
// Seeded as superuser, which bypasses RLS — this is the service-role equivalent.

async function seedOrg(name) {
  const { rows } = await db.query(
    `insert into organizations (name) values ($1) returning id`,
    [name]
  )
  return rows[0].id
}

async function seedUser(orgId, email, role, status = 'active') {
  const { rows: authRows } = await db.query(
    `insert into auth.users (email) values ($1) returning id`,
    [email]
  )
  const id = authRows[0].id
  await db.query(
    `insert into users (id, organization_id, full_name, email, role, status)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, orgId, email.split('@')[0], email, role, status]
  )
  return id
}

const orgA = await seedOrg('Org A')
const orgB = await seedOrg('Org B')

const owner = await seedUser(orgA, 'owner@a.com', 'owner')
const admin = await seedUser(orgA, 'admin@a.com', 'admin')
const manager = await seedUser(orgA, 'manager@a.com', 'manager')
const contributor = await seedUser(orgA, 'contrib@a.com', 'contributor')
const contributor2 = await seedUser(orgA, 'contrib2@a.com', 'contributor')
const viewer = await seedUser(orgA, 'viewer@a.com', 'viewer')
const deactivated = await seedUser(orgA, 'gone@a.com', 'manager', 'deactivated')
const ownerB = await seedUser(orgB, 'owner@b.com', 'owner')

async function seedFolder(orgId, name, createdBy) {
  const { rows } = await db.query(
    `insert into folders (organization_id, name, created_by) values ($1,$2,$3) returning id`,
    [orgId, name, createdBy]
  )
  return rows[0].id
}

async function seedAsset(orgId, filename, uploadedBy, folderId = null) {
  const { rows } = await db.query(
    `insert into assets (organization_id, folder_id, filename, file_type, r2_key, uploaded_by)
     values ($1,$2,$3,'image/png',$4,$5) returning id`,
    [orgId, folderId, filename, `org/${orgId}/assets/x/v1/${filename}`, uploadedBy]
  )
  return rows[0].id
}

const folderA = await seedFolder(orgA, 'Brand', owner)
const folderB = await seedFolder(orgB, 'Secret B', ownerB)
const assetA = await seedAsset(orgA, 'logo-a.png', manager, folderA)
const assetAOwnedByContrib = await seedAsset(orgA, 'contrib.png', contributor, folderA)
const assetB = await seedAsset(orgB, 'secret-b.png', ownerB, folderB)

const { rows: tagRows } = await db.query(
  `insert into tags (organization_id, name) values ($1,'brand') returning id`,
  [orgA]
)
const tagA = tagRows[0].id
const { rows: tagBRows } = await db.query(
  `insert into tags (organization_id, name) values ($1,'secret') returning id`,
  [orgB]
)
const tagB = tagBRows[0].id

const { rows: collRows } = await db.query(
  `insert into collections (organization_id, name, created_by) values ($1,'Campaign',$2) returning id`,
  [orgA, manager]
)
const collectionA = collRows[0].id

const { rows: shareRows } = await db.query(
  `insert into share_links (organization_id, token, asset_id, expires_at, created_by)
   values ($1,'tok-a',$2, now() + interval '7 days', $3) returning id`,
  [orgA, assetA, manager]
)
const shareA = shareRows[0].id
const { rows: shareBRows } = await db.query(
  `insert into share_links (organization_id, token, asset_id, expires_at, created_by)
   values ($1,'tok-b',$2, now() + interval '7 days', $3) returning id`,
  [orgB, assetB, ownerB]
)
const shareB = shareBRows[0].id

await db.query(
  `insert into asset_versions (asset_id, version_number, r2_key) values ($1,1,'k-a')`,
  [assetA]
)
await db.query(
  `insert into asset_versions (asset_id, version_number, r2_key) values ($1,1,'k-b')`,
  [assetB]
)
await db.query(`insert into asset_tags (asset_id, tag_id) values ($1,$2)`, [assetA, tagA])
await db.query(`insert into asset_tags (asset_id, tag_id) values ($1,$2)`, [assetB, tagB])
await db.query(`insert into collection_assets (collection_id, asset_id) values ($1,$2)`, [
  collectionA,
  assetA,
])
await db.query(
  `insert into metadata_fields (organization_id, field_key, label, field_type)
   values ($1,'campaign','Campaign','text')`,
  [orgA]
)

/* ------------------------- RLS enabled everywhere ------------------------- */

section('TICKET-003 — RLS enabled on all tables')
const ORG_SCOPED = [
  'users',
  'folders',
  'collections',
  'assets',
  'asset_versions',
  'tags',
  'asset_tags',
  'metadata_fields',
  'share_links',
]
const ALL_TABLES = [...ORG_SCOPED, 'organizations', 'collection_assets']

const { rows: rlsRows } = await db.query(
  `select relname, relrowsecurity from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r'`
)
const rlsMap = new Map(rlsRows.map((r) => [r.relname, r.relrowsecurity]))
for (const t of ORG_SCOPED) {
  check(`RLS enabled on ${t} (org-scoped per 03-security-access.md)`, rlsMap.get(t) === true)
}
check(
  'RLS also enabled on organizations + collection_assets (documented deviation)',
  rlsMap.get('organizations') === true && rlsMap.get('collection_assets') === true
)
check(
  `all ${ALL_TABLES.length} tables have RLS`,
  ALL_TABLES.every((t) => rlsMap.get(t) === true)
)

/* ---------------------------- has_permission() ---------------------------- */

section('TICKET-003 — has_permission() role mapping')
const permMatrix = [
  ['asset:create', { owner: true, admin: true, manager: true, contributor: true, viewer: false }],
  ['asset:update_any', { owner: true, admin: true, manager: true, contributor: false, viewer: false }],
  ['asset:delete_any', { owner: true, admin: true, manager: true, contributor: false, viewer: false }],
  ['folder:manage', { owner: true, admin: true, manager: true, contributor: false, viewer: false }],
  ['tag:manage', { owner: true, admin: true, manager: true, contributor: false, viewer: false }],
  ['metadata_field:manage', { owner: true, admin: true, manager: true, contributor: false, viewer: false }],
  ['share_link:create', { owner: true, admin: true, manager: true, contributor: true, viewer: false }],
  ['user:manage', { owner: true, admin: true, manager: false, contributor: false, viewer: false }],
  ['org:update', { owner: true, admin: true, manager: false, contributor: false, viewer: false }],
  ['org:delete', { owner: true, admin: false, manager: false, contributor: false, viewer: false }],
]
const ids = { owner, admin, manager, contributor, viewer }
for (const [perm, expectations] of permMatrix) {
  for (const [roleName, expected] of Object.entries(expectations)) {
    const { rows } = await db.query(`select public.has_permission($1,$2) as ok`, [
      ids[roleName],
      perm,
    ])
    check(`${roleName} ${expected ? 'has' : 'lacks'} ${perm}`, rows[0].ok === expected)
  }
}

const { rows: unknownPerm } = await db.query(`select public.has_permission($1,$2) as ok`, [
  owner,
  'totally:madeup',
])
check('unknown permission strings fail closed (even for Owner)', unknownPerm[0].ok === false)

const { rows: deactivatedPerm } = await db.query(`select public.has_permission($1,$2) as ok`, [
  deactivated,
  'asset:create',
])
check('deactivated user has no permissions', deactivatedPerm[0].ok === false)

/* ----------------------- cross-tenant isolation (A/B) ---------------------- */

section('TICKET-003 — Org A cannot READ Org B data')
await asUser(db, owner, async () => {
  const t = async (label, sql, params) => {
    const { rows } = await db.query(sql, params)
    check(label, rows.length === 0, `leaked ${rows.length} row(s)`)
  }
  await t('cannot read Org B organization row', `select * from organizations where id = $1`, [orgB])
  await t('cannot read Org B users', `select * from users where organization_id = $1`, [orgB])
  await t('cannot read Org B folders', `select * from folders where id = $1`, [folderB])
  await t('cannot read Org B assets', `select * from assets where id = $1`, [assetB])
  await t('cannot read Org B asset_versions', `select * from asset_versions where asset_id = $1`, [assetB])
  await t('cannot read Org B tags', `select * from tags where id = $1`, [tagB])
  await t('cannot read Org B asset_tags', `select * from asset_tags where asset_id = $1`, [assetB])
  await t('cannot read Org B share_links', `select * from share_links where id = $1`, [shareB])
  await t('cannot read Org B metadata_fields', `select * from metadata_fields where organization_id = $1`, [orgB])

  // Unfiltered selects must return only Org A rows.
  const { rows: allAssets } = await db.query(`select organization_id from assets`)
  check(
    'unfiltered SELECT on assets returns only own-org rows',
    allAssets.length > 0 && allAssets.every((r) => r.organization_id === orgA)
  )
  const { rows: allOrgs } = await db.query(`select id from organizations`)
  check(
    'unfiltered SELECT on organizations returns only own org',
    allOrgs.length === 1 && allOrgs[0].id === orgA
  )
})

section('TICKET-003 — Org A cannot WRITE Org B data')
await asUser(db, owner, async () => {
  await expectDenied(db, 'cannot UPDATE an Org B asset', () =>
    db.query(`update assets set filename = 'hacked.png' where id = $1`, [assetB])
  )
  await expectDenied(db, 'cannot DELETE an Org B asset', () =>
    db.query(`delete from assets where id = $1`, [assetB])
  )
  await expectDenied(db, 'cannot INSERT an asset into Org B', () =>
    db.query(
      `insert into assets (organization_id, filename, file_type, r2_key, uploaded_by)
       values ($1,'evil.png','image/png','k',$2)`,
      [orgB, owner]
    )
  )
  await expectDenied(db, 'cannot INSERT a folder into Org B', () =>
    db.query(`insert into folders (organization_id, name) values ($1,'evil')`, [orgB])
  )
  await expectDenied(db, 'cannot UPDATE the Org B organization row', () =>
    db.query(`update organizations set name = 'Pwned' where id = $1`, [orgB])
  )
  await expectDenied(db, 'cannot DELETE an Org B share link', () =>
    db.query(`delete from share_links where id = $1`, [shareB])
  )
  await expectDenied(db, 'cannot INSERT a tag into Org B', () =>
    db.query(`insert into tags (organization_id, name) values ($1,'evil')`, [orgB])
  )
  await expectDenied(db, 'cannot attach an Org B asset to an Org A collection', () =>
    db.query(`insert into collection_assets (collection_id, asset_id) values ($1,$2)`, [
      collectionA,
      assetB,
    ])
  )
  await expectDenied(db, 'cannot add a version row to an Org B asset', () =>
    db.query(
      `insert into asset_versions (asset_id, version_number, r2_key) values ($1,2,'evil')`,
      [assetB]
    )
  )
  await expectDenied(db, 'cannot move an Org A asset into Org B', () =>
    db.query(`update assets set organization_id = $1 where id = $2`, [orgB, assetA])
  )
})

/* ------------------------------ Viewer lockdown --------------------------- */

section('TICKET-003 — Viewer cannot write, even via a direct query')
await asUser(db, viewer, async () => {
  // Viewers can read and download.
  const { rows } = await db.query(`select id from assets where id = $1`, [assetA])
  check('viewer CAN read assets in their own org', rows.length === 1)

  await expectDenied(db, 'viewer cannot INSERT an asset', () =>
    db.query(
      `insert into assets (organization_id, filename, file_type, r2_key, uploaded_by)
       values ($1,'v.png','image/png','k',$2)`,
      [orgA, viewer]
    )
  )
  await expectDenied(db, 'viewer cannot UPDATE an asset', () =>
    db.query(`update assets set filename = 'v.png' where id = $1`, [assetA])
  )
  await expectDenied(db, 'viewer cannot DELETE an asset', () =>
    db.query(`delete from assets where id = $1`, [assetA])
  )
  await expectDenied(db, 'viewer cannot INSERT a folder', () =>
    db.query(`insert into folders (organization_id, name) values ($1,'v')`, [orgA])
  )
  await expectDenied(db, 'viewer cannot UPDATE a folder', () =>
    db.query(`update folders set name = 'v' where id = $1`, [folderA])
  )
  await expectDenied(db, 'viewer cannot DELETE a folder', () =>
    db.query(`delete from folders where id = $1`, [folderA])
  )
  await expectDenied(db, 'viewer cannot INSERT a tag', () =>
    db.query(`insert into tags (organization_id, name) values ($1,'v')`, [orgA])
  )
  await expectDenied(db, 'viewer cannot DELETE a tag', () =>
    db.query(`delete from tags where id = $1`, [tagA])
  )
  await expectDenied(db, 'viewer cannot tag an asset', () =>
    db.query(`insert into asset_tags (asset_id, tag_id) values ($1,$2)`, [assetA, tagA])
  )
  await expectDenied(db, 'viewer cannot untag an asset', () =>
    db.query(`delete from asset_tags where asset_id = $1`, [assetA])
  )
  await expectDenied(db, 'viewer cannot INSERT a share link', () =>
    db.query(
      `insert into share_links (organization_id, token, asset_id, expires_at, created_by)
       values ($1,'v-tok',$2, now() + interval '1 day', $3)`,
      [orgA, assetA, viewer]
    )
  )
  await expectDenied(db, 'viewer cannot revoke a share link', () =>
    db.query(`update share_links set revoked_at = now() where id = $1`, [shareA])
  )
  await expectDenied(db, 'viewer cannot DELETE a share link', () =>
    db.query(`delete from share_links where id = $1`, [shareA])
  )
  await expectDenied(db, 'viewer cannot create a metadata field', () =>
    db.query(
      `insert into metadata_fields (organization_id, field_key, label, field_type)
       values ($1,'x','X','text')`,
      [orgA]
    )
  )
  await expectDenied(db, 'viewer cannot change org branding', () =>
    db.query(`update organizations set brand_primary_color = '#000000' where id = $1`, [orgA])
  )
  await expectDenied(db, 'viewer cannot invite a user', () =>
    db.query(
      `insert into users (id, organization_id, email, role) values (gen_random_uuid(),$1,'x@a.com','admin')`,
      [orgA]
    )
  )
})

/* --------------------------- Contributor scoping -------------------------- */

section('TICKET-003 — Contributor is scoped to their own uploads')
await asUser(db, contributor, async () => {
  const own = await db.query(`update assets set filename = 'mine.png' where id = $1`, [
    assetAOwnedByContrib,
  ])
  check('contributor CAN update their own asset', own.affectedRows === 1)

  await expectDenied(db, "contributor cannot update someone else's asset", () =>
    db.query(`update assets set filename = 'theirs.png' where id = $1`, [assetA])
  )
  await expectDenied(db, "contributor cannot delete someone else's asset", () =>
    db.query(`delete from assets where id = $1`, [assetA])
  )
  await expectDenied(db, "contributor cannot tag someone else's asset", () =>
    db.query(`insert into asset_tags (asset_id, tag_id) values ($1,$2)`, [assetA, tagA])
  )
  await expectDenied(db, 'contributor cannot manage folder structure', () =>
    db.query(`insert into folders (organization_id, name) values ($1,'c')`, [orgA])
  )
  await expectDenied(db, 'contributor cannot rename an org tag', () =>
    db.query(`update tags set name = 'renamed' where id = $1`, [tagA])
  )
  await expectDenied(db, 'contributor cannot manage users', () =>
    db.query(`update users set role = 'admin' where id = $1`, [viewer])
  )

  const tagOwn = await db.query(
    `insert into asset_tags (asset_id, tag_id) values ($1,$2)`,
    [assetAOwnedByContrib, tagA]
  )
  check('contributor CAN tag their own asset', tagOwn.affectedRows === 1)

  await expectDenied(db, "contributor cannot share another user's asset", () =>
    db.query(
      `insert into share_links (organization_id, token, asset_id, expires_at, created_by)
       values ($1,'c-tok',$2, now() + interval '1 day', $3)`,
      [orgA, assetA, contributor]
    )
  )
  const shareOwn = await db.query(
    `insert into share_links (organization_id, token, asset_id, expires_at, created_by)
     values ($1,'c-tok-own',$2, now() + interval '1 day', $3)`,
    [orgA, assetAOwnedByContrib, contributor]
  )
  check('contributor CAN share their own asset', shareOwn.affectedRows === 1)
})

await asUser(db, contributor2, async () => {
  await expectDenied(db, "contributor cannot revoke another contributor's share link", () =>
    db.query(`update share_links set revoked_at = now() where id = $1`, [shareA])
  )
})

/* ------------------------- deactivated user lockout ----------------------- */

section('TICKET-003 — deactivated user loses access immediately')
await asUser(db, deactivated, async () => {
  const { rows } = await db.query(`select id from assets`)
  check('deactivated user reads zero rows', rows.length === 0)
  await expectDenied(db, 'deactivated user cannot write', () =>
    db.query(
      `insert into assets (organization_id, filename, file_type, r2_key, uploaded_by)
       values ($1,'d.png','image/png','k',$2)`,
      [orgA, deactivated]
    )
  )
})

section('TICKET-003 — anonymous (share-portal) role has no table access')
await asUser(
  db,
  null,
  async () => {
    const { rows } = await db.query(`select id from assets`)
    check('anon reads zero assets', rows.length === 0)
    const { rows: links } = await db.query(`select id from share_links`)
    check('anon reads zero share_links (token resolution is service-role only)', links.length === 0)
  },
  'anon'
)

/* -------------------- privilege-escalation / invariants ------------------- */

section('TICKET-003 — privilege escalation blocked')
await asUser(db, admin, async () => {
  await expectDenied(db, 'admin cannot promote themselves to owner', () =>
    db.query(`update users set role = 'owner' where id = $1`, [admin])
  )
  const promoted = await db.query(`update users set role = 'manager' where id = $1`, [viewer])
  check('admin CAN change another user’s role', promoted.affectedRows === 1)
})

await asUser(db, viewer, async () => {
  await expectDenied(db, 'viewer cannot self-promote', () =>
    db.query(`update users set role = 'owner' where id = $1`, [viewer])
  )
  const rename = await db.query(`update users set full_name = 'New Name' where id = $1`, [viewer])
  check('viewer CAN edit their own profile name', rename.affectedRows === 1)
})

section('03-security-access.md — last Owner invariant')
await asUser(db, owner, async () => {
  await expectDenied(db, 'last active Owner cannot demote themselves', () =>
    db.query(`update users set role = 'admin' where id = $1`, [owner])
  )
})
await asUser(db, admin, async () => {
  await expectDenied(
    db,
    'admin cannot deactivate the last Owner',
    () => db.query(`update users set status = 'deactivated' where id = $1`, [owner]),
    { match: /at least one active Owner/ }
  )
  await expectDenied(
    db,
    'admin cannot delete the last Owner',
    () => db.query(`delete from users where id = $1`, [owner]),
    { match: /at least one active Owner/ }
  )
})
// With a second owner present the restriction lifts.
await db.query(`update users set role = 'owner' where id = $1`, [manager])
await asUser(db, admin, async () => {
  const demote = await db.query(`update users set role = 'admin' where id = $1`, [owner])
  check('...but an Owner CAN be demoted once a second Owner exists', demote.affectedRows === 1)
})
await db.query(`update users set role = 'manager' where id = $1`, [manager])

section('03-security-access.md — asset_versions is an immutable audit trail')
await asUser(db, owner, async () => {
  await expectDenied(db, 'nobody can rewrite a prior version row', () =>
    db.query(`update asset_versions set r2_key = 'tampered' where asset_id = $1`, [assetA])
  )
  await expectDenied(db, 'nobody can delete a prior version row', () =>
    db.query(`delete from asset_versions where asset_id = $1`, [assetA])
  )
})

process.exit(summarize())
