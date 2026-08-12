/**
 * Dev-only migration/RLS verification harness.
 *
 * Runs the real migration SQL against PGlite (actual Postgres compiled to WASM),
 * so TICKET-002 and TICKET-003 acceptance criteria can be verified by execution
 * rather than by inspection. This exists because no live Supabase project was
 * available during the build (see memory.md).
 *
 * Caveats:
 *  - PGlite is Postgres 18; Supabase runs Postgres 15. Fine for DDL/RLS
 *    semantics, but not a substitute for running the migrations on the real
 *    project.
 *  - Supabase's `auth` schema, `auth.uid()` and the `authenticated`/`anon`
 *    roles are stubbed below to match Supabase's actual behaviour (auth.uid()
 *    reads the JWT claims out of a session GUC).
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
// Supabase ships these preinstalled; PGlite needs them registered explicitly.
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const here = dirname(fileURLToPath(import.meta.url))
export const migrationsDir = join(here, '..', 'migrations')

/** Recreates just enough of Supabase's auth plumbing for RLS to behave truly. */
const AUTH_STUB = `
create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- Supabase resolves the current user from the request's JWT claims, exposed as
-- a session-local GUC. Mirroring that exactly means our policies are exercised
-- the same way they will be in production.
--
-- The empty-string guard must come BEFORE the ::json cast: an unset GUC reads
-- back as '' in this context and ''::json raises 22P02. Real Supabase yields
-- NULL here, which the coalesce reproduces.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json ->>'sub',
    ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json ->> 'role', ''),
    'anon'
  );
$$;

-- Supabase's API roles. RLS is not enforced for superusers or table owners,
-- so all policy tests must run as one of these.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
`

const GRANTS = `
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
`

/**
 * Boots an in-memory Postgres, applies the auth stub then the listed migrations
 * in order.
 */
export async function createTestDb(migrationFiles) {
  const db = await PGlite.create({ extensions: { pg_trgm, pgcrypto } })
  await db.exec(AUTH_STUB)

  for (const file of migrationFiles) {
    const sql = await readFile(join(migrationsDir, file), 'utf8')
    try {
      await db.exec(sql)
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${err.message}`)
    }
  }

  await db.exec(GRANTS)
  return db
}

/**
 * Runs `fn` as the given Supabase role with the given user id in the JWT claims,
 * i.e. exactly the context a Server Action's anon-key client runs under.
 */
export async function asUser(db, userId, fn, role = 'authenticated') {
  await db.exec('begin')
  try {
    const claims = JSON.stringify({ sub: userId ?? null, role })
    await db.query('select set_config($1, $2, true)', ['request.jwt.claims', claims])
    await db.exec(`set local role ${role}`)
    return await fn()
  } finally {
    // Always unwind, even on a policy violation, so the next case starts clean.
    try {
      await db.exec('rollback')
    } catch {
      /* transaction already aborted */
    }
  }
}

/**
 * Like asUser, but WITHOUT a surrounding transaction, so writes persist.
 *
 * Needed by the sequential core-loop test, where each step builds on the last.
 * Note that expectDenied() cannot be used inside this (it relies on SAVEPOINT,
 * which requires a transaction block) — use asUser for denial assertions.
 */
export async function asUserCommitted(db, userId, fn, role = 'authenticated') {
  const claims = JSON.stringify({ sub: userId ?? null, role })
  await db.query('select set_config($1, $2, false)', ['request.jwt.claims', claims])
  await db.exec(`set role ${role}`)
  try {
    return await fn()
  } finally {
    // Back to the owning superuser so seeding/assertions aren't policy-bound.
    await db.exec('reset role')
  }
}

/* --------------------------- tiny assertion kit --------------------------- */

let passed = 0
let spCounter = 0
const failures = []

export function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ok   ${label}`)
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/**
 * Asserts a statement is rejected by RLS (or filtered to zero rows by it).
 *
 * Each attempt runs inside its own SAVEPOINT: a policy violation aborts the
 * surrounding transaction, so without this every check after the first denial
 * would fail with 25P02 rather than being evaluated.
 */
export async function expectDenied(db, label, promiseFactory, opts = {}) {
  const sp = `sp_${(spCounter += 1)}`
  await db.exec(`savepoint ${sp}`)

  const unwind = async () => {
    try {
      await db.exec(`rollback to savepoint ${sp}`)
    } catch {
      /* savepoint already gone */
    }
  }

  try {
    const result = await promiseFactory()
    await unwind()
    // An UPDATE/DELETE filtered to zero rows by a USING clause is also a denial.
    const affected = result?.affectedRows
    if (typeof affected === 'number' && affected === 0) {
      check(label, true)
      return
    }
    if (Array.isArray(result?.rows) && result.rows.length === 0) {
      check(label, true)
      return
    }
    check(label, false, 'statement unexpectedly succeeded')
  } catch (err) {
    await unwind()
    const msg = String(err.message ?? err)

    // When a specific rejection reason is expected (a deliberate `raise
    // exception` from one of the security triggers rather than an RLS policy),
    // require that exact message so a coincidental failure can't pass.
    if (opts.match) {
      const matched =
        opts.match instanceof RegExp ? opts.match.test(msg) : msg.includes(opts.match)
      check(label, matched, matched ? '' : `wrong error: ${msg}`)
      return
    }

    const isPolicy =
      msg.includes('row-level security') ||
      msg.includes('permission denied') ||
      msg.includes('insufficient')
    check(label, isPolicy, isPolicy ? '' : `failed for the wrong reason: ${msg}`)
  }
}

export function section(name) {
  console.log(`\n${name}`)
}

export function summarize() {
  console.log(`\n${'-'.repeat(60)}`)
  if (failures.length === 0) {
    console.log(`ALL CHECKS PASSED (${passed})`)
    return 0
  }
  console.log(`${passed} passed, ${failures.length} FAILED:`)
  failures.forEach((f) => console.log(`  - ${f}`))
  return 1
}
