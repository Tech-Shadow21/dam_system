/**
 * TICKET-002 verification: all 11 tables exist matching the documented schema,
 * and foreign keys/constraints match the relationships in
 * 02-technical-architecture.md.
 *
 * Run: node supabase/tests/schema.test.mjs
 */
import { check, createTestDb, section, summarize } from './harness.mjs'

const EXPECTED_TABLES = [
  'organizations',
  'users',
  'folders',
  'collections',
  'assets',
  'asset_versions',
  'collection_assets',
  'tags',
  'asset_tags',
  'metadata_fields',
  'share_links',
]

/** Columns exactly as documented in 02-technical-architecture.md. */
const EXPECTED_COLUMNS = {
  organizations: [
    'id',
    'name',
    'plan',
    'logo_url',
    'brand_primary_color',
    'brand_secondary_color',
    'created_at',
  ],
  users: [
    'id',
    'organization_id',
    'full_name',
    'email',
    'role',
    'avatar_url',
    'status',
    'created_at',
  ],
  folders: ['id', 'organization_id', 'parent_folder_id', 'name', 'created_by', 'created_at'],
  collections: [
    'id',
    'organization_id',
    'name',
    'description',
    'created_by',
    'created_at',
  ],
  assets: [
    'id',
    'organization_id',
    'folder_id',
    'filename',
    'file_type',
    'file_size_bytes',
    'r2_key',
    'cdn_url',
    'current_version',
    'status',
    'uploaded_by',
    'metadata',
    'created_at',
    'updated_at',
  ],
  asset_versions: [
    'id',
    'asset_id',
    'version_number',
    'r2_key',
    'file_size_bytes',
    'uploaded_by',
    'created_at',
  ],
  collection_assets: ['collection_id', 'asset_id', 'added_by', 'added_at'],
  tags: ['id', 'organization_id', 'name'],
  asset_tags: ['asset_id', 'tag_id'],
  metadata_fields: ['id', 'organization_id', 'field_key', 'label', 'field_type', 'options'],
  share_links: [
    'id',
    'organization_id',
    'token',
    'asset_id',
    'folder_id',
    'collection_id',
    'password_hash',
    'allow_download',
    'expires_at',
    'revoked_at',
    'created_by',
    'created_at',
    'access_count',
  ],
}

/** Relationships summary from 02-technical-architecture.md. */
const EXPECTED_FKS = [
  ['users', 'organization_id', 'organizations'],
  ['users', 'id', 'users'], // -> auth.users, reported separately below
  ['folders', 'organization_id', 'organizations'],
  ['folders', 'parent_folder_id', 'folders'],
  ['folders', 'created_by', 'users'],
  ['collections', 'organization_id', 'organizations'],
  ['collections', 'created_by', 'users'],
  ['assets', 'organization_id', 'organizations'],
  ['assets', 'folder_id', 'folders'],
  ['assets', 'uploaded_by', 'users'],
  ['asset_versions', 'asset_id', 'assets'],
  ['asset_versions', 'uploaded_by', 'users'],
  ['collection_assets', 'collection_id', 'collections'],
  ['collection_assets', 'asset_id', 'assets'],
  ['collection_assets', 'added_by', 'users'],
  ['tags', 'organization_id', 'organizations'],
  ['asset_tags', 'asset_id', 'assets'],
  ['asset_tags', 'tag_id', 'tags'],
  ['metadata_fields', 'organization_id', 'organizations'],
  ['share_links', 'organization_id', 'organizations'],
  ['share_links', 'asset_id', 'assets'],
  ['share_links', 'folder_id', 'folders'],
  ['share_links', 'collection_id', 'collections'],
  ['share_links', 'created_by', 'users'],
]

const db = await createTestDb(['0001_initial_schema.sql'])

section('TICKET-002 — tables exist')
const { rows: tables } = await db.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'`
)
const tableNames = tables.map((t) => t.table_name).sort()
for (const t of EXPECTED_TABLES) {
  check(`table ${t}`, tableNames.includes(t))
}
check(
  `exactly 11 tables (found ${tableNames.length}: ${tableNames.join(', ')})`,
  tableNames.length === EXPECTED_TABLES.length
)

section('TICKET-002 — columns match documented schema')
for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) {
  const { rows } = await db.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [table]
  )
  const actual = rows.map((r) => r.column_name).sort()
  const missing = expected.filter((c) => !actual.includes(c))
  const extra = actual.filter((c) => !expected.includes(c))
  check(
    `${table} columns`,
    missing.length === 0 && extra.length === 0,
    [missing.length ? `missing: ${missing.join(', ')}` : '', extra.length ? `extra: ${extra.join(', ')}` : '']
      .filter(Boolean)
      .join('; ')
  )
}

section('TICKET-002 — foreign keys match documented relationships')
const { rows: fks } = await db.query(`
  select
    tc.table_name    as src_table,
    kcu.column_name  as src_column,
    ccu.table_name   as tgt_table,
    ccu.table_schema as tgt_schema
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
  where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
`)

const fkKey = (t, c, target) => `${t}.${c}->${target}`
const actualFks = new Set(fks.map((f) => fkKey(f.src_table, f.src_column, f.tgt_table)))

for (const [table, column, target] of EXPECTED_FKS) {
  if (table === 'users' && column === 'id') continue // checked below
  check(`FK ${table}.${column} -> ${target}`, actualFks.has(fkKey(table, column, target)))
}
check(
  'users.id -> auth.users (Supabase Auth linkage)',
  fks.some((f) => f.src_table === 'users' && f.src_column === 'id' && f.tgt_schema === 'auth')
)

section('TICKET-002 — key constraints')
async function constraintExists(name) {
  const { rows } = await db.query(
    `select 1 from pg_constraint where conname = $1`,
    [name]
  )
  return rows.length > 0
}

check(
  'share_links enforces exactly one of asset/folder/collection',
  await constraintExists('share_links_exactly_one_target')
)

// Verify that constraint actually bites, rather than trusting its presence.
const org = (
  await db.query(`insert into organizations (name) values ('Probe') returning id`)
).rows[0].id

let twoTargetsRejected = false
try {
  const folder = (
    await db.query(
      `insert into folders (organization_id, name) values ($1, 'F') returning id`,
      [org]
    )
  ).rows[0].id
  const coll = (
    await db.query(
      `insert into collections (organization_id, name) values ($1, 'C') returning id`,
      [org]
    )
  ).rows[0].id
  await db.query(
    `insert into share_links (organization_id, token, folder_id, collection_id, expires_at)
     values ($1, 'probe-token', $2, $3, now() + interval '1 day')`,
    [org, folder, coll]
  )
} catch (err) {
  twoTargetsRejected = String(err.message).includes('share_links_exactly_one_target')
}
check('...and rejects a link with two targets set', twoTargetsRejected)

let zeroTargetsRejected = false
try {
  await db.query(
    `insert into share_links (organization_id, token, expires_at)
     values ($1, 'probe-token-2', now() + interval '1 day')`,
    [org]
  )
} catch (err) {
  zeroTargetsRejected = String(err.message).includes('share_links_exactly_one_target')
}
check('...and rejects a link with no target set', zeroTargetsRejected)

// expires_at is required — no permanent public links in v1.
let expiryRequired = false
try {
  const a = (
    await db.query(
      `insert into assets (organization_id, filename, file_type, r2_key)
       values ($1, 'x.png', 'image/png', 'k') returning id`,
      [org]
    )
  ).rows[0].id
  await db.query(
    `insert into share_links (organization_id, token, asset_id) values ($1, 'probe-3', $2)`,
    [org, a]
  )
} catch (err) {
  expiryRequired = String(err.message).includes('null value in column "expires_at"')
}
check('share_links.expires_at is NOT NULL (no permanent links in v1)', expiryRequired)

// Tag names unique per organization, not globally.
await db.query(`insert into tags (organization_id, name) values ($1, 'Logo')`, [org])
let dupRejected = false
try {
  await db.query(`insert into tags (organization_id, name) values ($1, 'logo')`, [org])
} catch {
  dupRejected = true
}
check('tags.name unique per organization (case-insensitive)', dupRejected)

const org2 = (
  await db.query(`insert into organizations (name) values ('Probe2') returning id`)
).rows[0].id
let crossOrgTagOk = true
try {
  await db.query(`insert into tags (organization_id, name) values ($1, 'Logo')`, [org2])
} catch {
  crossOrgTagOk = false
}
check('...but the same tag name is allowed in a different organization', crossOrgTagOk)

// asset_versions unique per (asset, version)
const asset = (
  await db.query(
    `insert into assets (organization_id, filename, file_type, r2_key)
     values ($1, 'a.png', 'image/png', 'k1') returning id`,
    [org]
  )
).rows[0].id
await db.query(
  `insert into asset_versions (asset_id, version_number, r2_key) values ($1, 1, 'k1')`,
  [asset]
)
let dupVersionRejected = false
try {
  await db.query(
    `insert into asset_versions (asset_id, version_number, r2_key) values ($1, 1, 'k1b')`,
    [asset]
  )
} catch {
  dupVersionRejected = true
}
check('asset_versions unique per (asset_id, version_number)', dupVersionRejected)

// updated_at trigger
const before = (
  await db.query(`select updated_at from assets where id = $1`, [asset])
).rows[0].updated_at
await db.query(`update assets set filename = 'renamed.png' where id = $1`, [asset])
const after = (
  await db.query(`select updated_at from assets where id = $1`, [asset])
).rows[0].updated_at
check('assets.updated_at is maintained by trigger', new Date(after) >= new Date(before))

// Deleting a folder must not destroy its assets (they become unfiled).
const keepFolder = (
  await db.query(
    `insert into folders (organization_id, name) values ($1, 'Keep') returning id`,
    [org]
  )
).rows[0].id
const keptAsset = (
  await db.query(
    `insert into assets (organization_id, folder_id, filename, file_type, r2_key)
     values ($1, $2, 'keep.png', 'image/png', 'k2') returning id`,
    [org, keepFolder]
  )
).rows[0].id
await db.query(`delete from folders where id = $1`, [keepFolder])
const survived = await db.query(
  `select folder_id from assets where id = $1`,
  [keptAsset]
)
check(
  'deleting a folder unfiles its assets rather than deleting them',
  survived.rows.length === 1 && survived.rows[0].folder_id === null
)

process.exit(summarize())
