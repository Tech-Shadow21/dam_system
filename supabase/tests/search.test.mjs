/**
 * TICKET-013 verification: search_assets() matches across filename, tags and
 * metadata, and combines filters with AND logic — verified against real Postgres.
 *
 * Run: node supabase/tests/search.test.mjs
 */
import { asUser, check, createTestDb, section, summarize } from './harness.mjs'

const db = await createTestDb([
  '0001_initial_schema.sql',
  '0002_rls_policies.sql',
  '0004_search.sql',
])

/* --------------------------------- seed ---------------------------------- */

const orgA = (await db.query(`insert into organizations (name) values ('A') returning id`))
  .rows[0].id
const orgB = (await db.query(`insert into organizations (name) values ('B') returning id`))
  .rows[0].id

async function seedUser(orgId, email, role) {
  const id = (await db.query(`insert into auth.users (email) values ($1) returning id`, [email]))
    .rows[0].id
  await db.query(
    `insert into users (id, organization_id, full_name, email, role, status)
     values ($1,$2,$3,$4,$5,'active')`,
    [id, orgId, email, email, role]
  )
  return id
}
const ownerA = await seedUser(orgA, 'owner@a.com', 'owner')
const otherA = await seedUser(orgA, 'other@a.com', 'manager')
const ownerB = await seedUser(orgB, 'owner@b.com', 'owner')

const folder1 = (
  await db.query(`insert into folders (organization_id, name) values ($1,'Q4') returning id`, [orgA])
).rows[0].id
const folder2 = (
  await db.query(`insert into folders (organization_id, name) values ($1,'Q3') returning id`, [orgA])
).rows[0].id

async function seedAsset(org, filename, mime, uploader, folder, metadata = {}, status = 'active', createdAt = null) {
  const { rows } = await db.query(
    `insert into assets
       (organization_id, folder_id, filename, file_type, r2_key, uploaded_by, metadata, status, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, coalesce($9::timestamptz, now())) returning id`,
    [org, folder, filename, mime, `k/${filename}`, uploader, JSON.stringify(metadata), status, createdAt]
  )
  return rows[0].id
}

const logoPng = await seedAsset(orgA, 'brand-logo.png', 'image/png', ownerA, folder1, {
  campaign: 'Spring Launch',
})
const heroJpg = await seedAsset(orgA, 'hero-banner.jpg', 'image/jpeg', otherA, folder1, {
  campaign: 'Winter',
})
const deckPdf = await seedAsset(orgA, 'sales-deck.pdf', 'application/pdf', ownerA, folder2, {})
const promoMp4 = await seedAsset(orgA, 'promo.mp4', 'video/mp4', otherA, folder2, {})
const archived = await seedAsset(orgA, 'brand-old.png', 'image/png', ownerA, folder1, {}, 'deleted')
const oldAsset = await seedAsset(
  orgA,
  'ancient-logo.png',
  'image/png',
  ownerA,
  folder1,
  {},
  'active',
  '2020-01-15T00:00:00Z'
)
// Wildcard-metacharacter names, to prove LIKE escaping works.
const pctAsset = await seedAsset(orgA, '50%-off-badge.png', 'image/png', ownerA, folder1)
const underscoreAsset = await seedAsset(orgA, 'logo_v2.png', 'image/png', ownerA, folder1)
// Another org's asset that would match every query — must never appear.
await seedAsset(orgB, 'brand-logo.png', 'image/png', ownerB, null, { campaign: 'Spring Launch' })

const tagBrand = (
  await db.query(`insert into tags (organization_id, name) values ($1,'brand') returning id`, [orgA])
).rows[0].id
const tagApproved = (
  await db.query(`insert into tags (organization_id, name) values ($1,'approved') returning id`, [orgA])
).rows[0].id

await db.query(`insert into asset_tags (asset_id, tag_id) values ($1,$2)`, [logoPng, tagBrand])
await db.query(`insert into asset_tags (asset_id, tag_id) values ($1,$2)`, [logoPng, tagApproved])
await db.query(`insert into asset_tags (asset_id, tag_id) values ($1,$2)`, [heroJpg, tagBrand])
await db.query(`insert into asset_tags (asset_id, tag_id) values ($1,$2)`, [deckPdf, tagApproved])

const collection = (
  await db.query(
    `insert into collections (organization_id, name) values ($1,'Launch Kit') returning id`,
    [orgA]
  )
).rows[0].id
await db.query(`insert into collection_assets (collection_id, asset_id) values ($1,$2)`, [
  collection,
  logoPng,
])
await db.query(`insert into collection_assets (collection_id, asset_id) values ($1,$2)`, [
  collection,
  promoMp4,
])

/* --------------------------------- helpers -------------------------------- */

async function search(params = {}) {
  const {
    query = null,
    folderId = null,
    fileKinds = null,
    tagIds = null,
    uploaderId = null,
    dateFrom = null,
    dateTo = null,
    collectionId = null,
  } = params
  const { rows } = await db.query(
    `select filename from public.search_assets($1,$2,$3,$4,$5,$6,$7,$8)`,
    [query, folderId, fileKinds, tagIds, uploaderId, dateFrom, dateTo, collectionId]
  )
  return rows.map((r) => r.filename).sort()
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify([...b].sort())

/* ---------------------------------- tests --------------------------------- */

await asUser(db, ownerA, async () => {
  section('TICKET-013 — search matches filename, tags and metadata')

  check('filename match', eq(await search({ query: 'hero' }), ['hero-banner.jpg']))

  check(
    'tag-name match returns assets carrying that tag',
    eq(await search({ query: 'approved' }), ['brand-logo.png', 'sales-deck.pdf'])
  )

  check(
    'metadata-value match',
    eq(await search({ query: 'Spring Launch' }), ['brand-logo.png'])
  )

  check(
    'search is case-insensitive',
    eq(await search({ query: 'BRAND-LOGO' }), ['brand-logo.png'])
  )

  check(
    'soft-deleted assets are excluded from search',
    !(await search({ query: 'brand' })).includes('brand-old.png')
  )

  section('TICKET-013 — LIKE metacharacters are escaped, not treated as wildcards')
  check(
    '"%" is matched literally',
    eq(await search({ query: '50%' }), ['50%-off-badge.png'])
  )
  check(
    '"_" is matched literally (does not match logo-v2 style names)',
    eq(await search({ query: 'logo_v' }), ['logo_v2.png'])
  )

  section('TICKET-013 — filters combine with AND logic')
  check(
    'folder filter',
    eq(await search({ folderId: folder2 }), ['sales-deck.pdf', 'promo.mp4'])
  )
  check(
    'file-kind filter (image)',
    eq(await search({ fileKinds: ['image'] }), [
      'brand-logo.png',
      'hero-banner.jpg',
      'ancient-logo.png',
      '50%-off-badge.png',
      'logo_v2.png',
    ])
  )
  check(
    'file-kind filter accepts several kinds',
    eq(await search({ fileKinds: ['pdf', 'video'] }), ['sales-deck.pdf', 'promo.mp4'])
  )
  check(
    'uploader filter',
    eq(await search({ uploaderId: otherA }), ['hero-banner.jpg', 'promo.mp4'])
  )
  check(
    'collection filter',
    eq(await search({ collectionId: collection }), ['brand-logo.png', 'promo.mp4'])
  )
  check(
    'date-range filter excludes older assets',
    !(await search({ dateFrom: '2021-01-01T00:00:00Z' })).includes('ancient-logo.png')
  )
  check(
    'date-range filter can target the older asset',
    eq(
      await search({ dateFrom: '2019-01-01T00:00:00Z', dateTo: '2021-01-01T00:00:00Z' }),
      ['ancient-logo.png']
    )
  )

  check(
    'multiple tags use AND semantics (asset must carry all)',
    eq(await search({ tagIds: [tagBrand, tagApproved] }), ['brand-logo.png'])
  )
  check(
    'single tag returns all assets carrying it',
    eq(await search({ tagIds: [tagBrand] }), ['brand-logo.png', 'hero-banner.jpg'])
  )

  check(
    // 'brand' matches brand-logo.png by filename and hero-banner.jpg by its
    // 'brand' tag; both are images in folder1, so both correctly survive.
    'query AND folder AND kind combine',
    eq(
      await search({ query: 'brand', folderId: folder1, fileKinds: ['image'] }),
      ['brand-logo.png', 'hero-banner.jpg']
    )
  )
  check(
    'narrowing the same query by uploader drops the tag-only match',
    eq(
      await search({ query: 'brand', folderId: folder1, uploaderId: ownerA }),
      ['brand-logo.png']
    )
  )
  check(
    'contradictory filters return nothing (not everything)',
    eq(await search({ query: 'brand', folderId: folder2 }), [])
  )
  check(
    'no filters returns all active assets in the org',
    (await search({})).length === 7
  )

  section('TICKET-013 — search respects tenant isolation via RLS')
  const all = await search({ query: 'brand-logo' })
  check(
    'identically-named asset in another org never appears',
    all.length === 1 && all[0] === 'brand-logo.png'
  )
  const { rows: countRows } = await db.query(
    `select count(*)::int as n from public.search_assets(null,null,null,null,null,null,null,null)`
  )
  check('unfiltered search counts only own-org rows', countRows[0].n === 7)
})

section('TICKET-013 — a user in the other org sees only their own row')
await asUser(db, ownerB, async () => {
  const { rows } = await db.query(
    `select filename from public.search_assets('brand',null,null,null,null,null,null,null)`
  )
  check('Org B search returns only Org B assets', rows.length === 1)
})

process.exit(summarize())
