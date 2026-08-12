/**
 * Guards against drift between the two copies of the permission matrix:
 *   - public.has_permission()  in supabase/migrations/0002_rls_policies.sql  (the real boundary)
 *   - PERMISSIONS              in lib/permissions.ts                        (UI gating only)
 *
 * If they disagree, the UI either hides an action a user can perform, or — worse
 * — offers one the database will reject. Parses the TS source rather than
 * importing it, so no build step is needed.
 *
 * Run: node supabase/tests/permission-parity.test.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, createTestDb, section, summarize } from './harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const permsSource = await readFile(join(here, '..', '..', 'lib', 'permissions.ts'), 'utf8')

const ROLES = ['owner', 'admin', 'manager', 'contributor', 'viewer']

/* ------------------- parse lib/permissions.ts ------------------- */

// Resolve the role-group constants (ALL, MANAGER_UP, ...) to role arrays.
const groups = {}
for (const m of permsSource.matchAll(
  /const (\w+): UserRole\[\] = \[([^\]]*)\]/g
)) {
  groups[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1])
}

const tsMatrix = {}
const blockMatch = permsSource.match(
  /const PERMISSIONS: Record<Permission, UserRole\[\]> = \{([\s\S]*?)\n\}/
)
if (!blockMatch) {
  console.error('Could not locate the PERMISSIONS map in lib/permissions.ts')
  process.exit(1)
}
for (const line of blockMatch[1].split('\n')) {
  const entry = line.match(/'([\w:]+)':\s*(\w+)/)
  if (!entry) continue
  const [, permission, groupName] = entry
  if (!groups[groupName]) {
    console.error(`Unknown role group "${groupName}" for ${permission}`)
    process.exit(1)
  }
  tsMatrix[permission] = groups[groupName]
}

/* ------------------------- seed one user per role ------------------------- */

const db = await createTestDb(['0001_initial_schema.sql', '0002_rls_policies.sql'])
const org = (await db.query(`insert into organizations (name) values ('P') returning id`)).rows[0]
  .id

const userIds = {}
for (const role of ROLES) {
  const id = (
    await db.query(`insert into auth.users (email) values ($1) returning id`, [`${role}@p.com`])
  ).rows[0].id
  await db.query(
    `insert into users (id, organization_id, email, role, status)
     values ($1,$2,$3,$4,'active')`,
    [id, org, `${role}@p.com`, role]
  )
  userIds[role] = id
}

/* ------------------------------- compare -------------------------------- */

section('Permission parity — lib/permissions.ts vs has_permission()')

const tsPermissions = Object.keys(tsMatrix).sort()
check(`parsed ${tsPermissions.length} permissions from lib/permissions.ts`, tsPermissions.length > 0)

// Every permission the SQL function knows about, pulled from its CASE arms.
const sqlSource = await readFile(
  join(here, '..', 'migrations', '0002_rls_policies.sql'),
  'utf8'
)
const sqlPermissions = [
  ...new Set([...sqlSource.matchAll(/when '([\w:]+)'\s+then/g)].map((m) => m[1])),
].sort()

const missingInTs = sqlPermissions.filter((p) => !tsPermissions.includes(p))
const missingInSql = tsPermissions.filter((p) => !sqlPermissions.includes(p))
check(
  'both copies define the same permission set',
  missingInTs.length === 0 && missingInSql.length === 0,
  [
    missingInTs.length ? `absent from lib/permissions.ts: ${missingInTs.join(', ')}` : '',
    missingInSql.length ? `absent from has_permission(): ${missingInSql.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ')
)

let mismatches = 0
for (const permission of tsPermissions) {
  for (const role of ROLES) {
    const { rows } = await db.query(`select public.has_permission($1,$2) as ok`, [
      userIds[role],
      permission,
    ])
    const sqlSays = rows[0].ok === true
    const tsSays = tsMatrix[permission].includes(role)
    if (sqlSays !== tsSays) {
      mismatches += 1
      check(
        `${role} / ${permission}`,
        false,
        `lib/permissions.ts says ${tsSays}, has_permission() says ${sqlSays}`
      )
    }
  }
}
check(
  `all ${tsPermissions.length * ROLES.length} role/permission pairs agree`,
  mismatches === 0,
  mismatches ? `${mismatches} disagreement(s)` : ''
)

process.exit(summarize())
