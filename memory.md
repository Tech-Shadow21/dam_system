# Memory Log — Vaultra

Last updated: 2026-07-31

## Currently Working On
- Nothing in flight. MVP build (TICKET-001 → TICKET-020) is code-complete.
- **The single blocking next step is supplying real Supabase credentials and
  running the migrations.** Nothing in this build has run against live
  infrastructure — see "Unverified Against Live Infrastructure" below.

## Completed

All 20 tickets are implemented. Verification status per ticket:

| Ticket | Scope | Verified how |
|---|---|---|
| 001 | Scaffolding, Tailwind theme, fonts, UI primitives | Dev server 200; all 12 palette hexes confirmed present in compiled CSS; all three fonts served; primitive states rendered |
| 002 | 11-table schema + `types/database.ts` | 56 automated checks against real Postgres (tables, columns, FKs, constraints, triggers) |
| 003 | RLS on all tables + `has_permission()` | 126 automated checks: cross-tenant isolation, Viewer lockdown, Contributor scoping, deactivation, anon lockout, privilege escalation, last-Owner invariant |
| 004 | Signup / login / invite | Routes render; **flows not executed** (needs live Auth) |
| 005 | App shell & navigation | Renders; role-based nav filtering implemented |
| 006 | Folder CRUD, tree, breadcrumb | Builds; folder-delete-unfiles-assets behaviour proven in schema test |
| 007 | Upload (single & bulk) | Builds; **upload path not executed** (needs live Storage) |
| 008 | Grid & list views, multi-select, bulk bar | Builds; renders |
| 009 | Asset detail & preview | Builds; renders |
| 010 | Version history & restore | Version append/increment/immutability proven in core-loop test |
| 011 | Metadata fields configuration | Builds; renders |
| 012 | Tagging + autocomplete + bulk tag | Tag create/attach/search proven in core-loop test |
| 013 | Search & filter | 23 automated checks on `search_assets()` incl. AND-combining and LIKE escaping |
| 014 | Collections | Builds; renders |
| 015 | Share link creation & management | Create/resolve/revoke/expire proven in core-loop test |
| 016 | Branded external share portal | Renders; **password gate + signed downloads not executed** |
| 017 | Organization branding settings | Builds; **logo upload not executed** (needs live Storage) |
| 018 | User & role management | Role-change and last-Owner rules proven at DB layer; **invite issuance not executed** |
| 019 | Empty / loading / error states | Loading skeletons, error boundaries, 404 and empty states on every list view |
| 020 | Responsive & accessibility | 21 computed WCAG contrast checks pass; ESLint jsx-a11y clean; skip links, focus trap, reduced-motion |

**Automated verification: 256 checks across 6 suites, all passing.**
`npm run verify` runs typecheck → all DB/a11y suites → production build.
`npm run build` is clean with zero type errors (22 routes).

## Blocked / Needs Decision

1. **Supabase credentials (blocking).** `.env.local` holds obvious placeholders.
   Replace them, then apply `supabase/migrations/0001…0004` in order, then
   `supabase/seed.sql` if a demo org is wanted.
2. **Invitation email delivery.** No transactional email provider is wired.
   `inviteUserAction` creates the auth user and returns a **copyable invite
   link** that the admin shares manually. This was deliberate: Supabase's
   built-in SMTP is rate-limited to a handful of emails/hour on the free tier, so
   depending on it for invites would be fragile and untestable. Wiring Resend or
   Postmark is a small, self-contained follow-up.
3. **Product name** still "Vaultra" throughout, per instruction to proceed.
   Renaming remains a find-and-replace across `docs/` + code.
4. **Divider contrast (`#E2E0DA` on white = 1.32:1).** An explicit value in
   `04-frontend-specification.md`, kept as specified. Not a blocker: no control
   is identified by that border alone (inputs carry persistent visible labels;
   the focus ring is navy at 13.2:1). Raising it is a design-system call for you,
   not something to change unilaterally.

## Unverified Against Live Infrastructure

Everything below is written and type-checked but has **never executed against a
real Supabase project**. Treat each as unproven:

- **Supabase Auth**: signup, login, logout, invite `generateLink`, `verifyOtp`
  token exchange, `signOut(userId,'global')` on deactivation.
- **Supabase Storage**: `createSignedUploadUrl`, browser `PUT` to the signed URL,
  `objectExists` confirmation, `createSignedUrl` for previews/downloads, object
  `copy` during version restore, `remove` on purge.
- **Storage bucket RLS** (`0003_storage_bucket_policies.sql`): cannot be tested
  in PGlite, which has no `storage` schema. **This migration is the least-tested
  code in the build and it is a security boundary — verify it first.**
- **sharp thumbnail generation**: the library loads and its native binary works
  (libvips 8.15.3 confirmed), but no image has been processed end to end.
- **`next/image` optimization** of Supabase-hosted signed URLs. Note that signed
  URLs carry an expiring token in the query string, which interacts with image
  caching — worth watching.
- **Middleware session refresh** against a real Auth cookie.

The test harness (`supabase/tests/`) runs migrations against **PGlite (Postgres
18 in WASM)**, whereas Supabase runs **Postgres 15**. Fine for DDL/RLS semantics,
not a substitute for applying the migrations to the real project.

## Decisions Log

- **2026-07-30:** Swapped Cloudflare Images for a fully free alternative —
  `sharp` generates thumbnail/preview variants at upload time; Next.js Image
  Optimization serves them. Trade-off: thumbnail generation is app-owned logic
  (one more failure/retry path); PDF/video use generic file-type icons in MVP.

- **2026-07-31: Cloudflare R2 → Supabase Storage.** Asset binaries now live in
  Supabase Storage. Reason: the whole stack runs on credentials already held — no
  new vendor signup and no credit card, versus R2 which requires billing details
  before it can be enabled. Secondary benefit: permission logic stays in one
  place (Postgres RLS) instead of split between RLS and R2 presigned-URL logic.
  - `lib/r2/*` → `lib/storage/{client,upload,thumbnails}.ts`
  - `R2_*` env vars dropped; added non-secret `SUPABASE_STORAGE_BUCKET`
  - `assets.r2_key` / `asset_versions.r2_key` **column names retained** to avoid
    a pointless rename migration; they now hold Supabase Storage object paths
  - Object key pattern unchanged: `org/{organization_id}/assets/{asset_id}/v{n}/{filename}`
  - **KNOWN TRADE-OFF (do not build contingency code for this now):** Supabase
    Storage's free tier caps at **1 GB**, versus R2's much larger practical
    ceiling and zero egress fees. Fine for MVP development and early testing. If
    asset libraries or share-link traffic grow, migrating to R2 (or Backblaze B2
    as a middle ground) is a future documented decision. Storage usage is
    surfaced in Settings → Organization with a 1 GB gauge so the ceiling is
    visible before it bites.

### Deviations from the planning docs (and why)

- **RLS on 11 tables, not 9.** `03-security-access.md` lists 9 org-scoped tables
  and omits `collection_assets`, which carries no `organization_id` — exactly
  like `asset_versions` and `asset_tags`, which it *does* list. Leaving it
  unprotected would be a real cross-tenant read/write hole, so RLS is enabled on
  all 11 (including `organizations`). Tables without their own `organization_id`
  inherit scope via a join on their parent, as the doc prescribes for
  `asset_versions`.
- **Self-signup vs invite-only.** `03` says invite-only "rather than open
  self-signup"; `01` App Flow step 1 and TICKET-004 require a new user to create
  an org as Owner. Read as complementary: open signup creates org + Owner, all
  *subsequent* users are invite-only. There is deliberately **no INSERT policy on
  `organizations`** for authenticated sessions — org creation only happens
  service-role during signup.
- **Contributor delete.** The role's "Can Do" column doesn't list delete, but its
  "Cannot Do" says "edit or delete assets uploaded by others", which only makes
  sense if deleting one's own upload is allowed. Implemented as
  `asset:delete_own`.
- **Version restore is additive.** Rather than rewinding `current_version`
  (which would discard history), restoring copies the chosen version forward as a
  new version. This matches the append-only immutability enforced on
  `asset_versions` (no UPDATE/DELETE policy exists on that table for any role).
- **`warning-ink` (#8A5E1B) added to the palette.** The spec's warning
  `#C98A2C` reaches only 2.93:1 on white, failing WCAG AA for text and 1.4.11 for
  meaningful icons. `#C98A2C` is retained for fills/borders; the darker shade of
  the same hue is used wherever warning is carried by text or an icon (5.68:1).
- **Two `lib/` files not in the documented structure:** `lib/queries.ts` (shared
  server-side reads needed by several routes — mutations still live in colocated
  `actions.ts` files as specified) and `lib/share-links.ts` (token
  signing/resolution needed by both the dashboard and the public portal; that
  logic must not be duplicated across a trust boundary).
- **`force-dynamic` on the dashboard layout and share portal.** Next infers
  dynamic rendering from `cookies()` access. Making it explicit means a refactor
  that short-circuits before reading cookies can't silently turn a tenant-scoped
  page into a shared static asset — the failure mode would be a cross-tenant
  leak.
- **`@supabase/ssr` upgraded 0.5.2 → 0.12.4.** 0.5.2 imports `GenericSchema`
  from a deep path that moved in `supabase-js` 2.111, which broke
  `createServerClient` overload resolution and silently collapsed every row type
  to `never`. Not a preference — the pinned pair was incompatible.
- **`types/database.ts` is hand-authored**, matching `0001_initial_schema.sql`
  exactly, because `supabase gen types` needs a live project. **Regenerate it
  from the real project once credentials exist.**
- **`uuid-ossp` dropped** from the migration; `gen_random_uuid()` is core
  Postgres 13+, so the extension was never needed.
- **Dev dependency added: `@electric-sql/pglite`.** Runs the real migrations
  against actual Postgres compiled to WASM. Added specifically because TICKET-003
  requires *verifying* cross-org isolation "with a manual test using two seeded
  orgs" — without live credentials this is the only way to actually satisfy that
  rather than assert it. Dev-only; not shipped.

## Risks To Address Before Real Users

1. **Storage bucket RLS is untested** (`0003`). It's the boundary keeping one
   tenant's binaries away from another. Verify manually with two orgs before any
   real asset goes in.
2. **Share-link password cooldown is in-process memory** (`lib/share-links.ts`).
   The 5-attempts-then-60s counter resets on cold start and is per serverless
   instance, so on Vercel it is weak against a determined attacker. Move it to a
   Postgres table or Upstash before relying on password-protected links.
3. **No rate limiting anywhere else** — login, signup and share-token probing are
   all unthrottled. Supabase Auth has some built-in protection; the app adds none.
4. **Thumbnail generation runs inline in the upload-completion request.** A large
   image makes that request slow, and Vercel's free-tier function timeout could
   cut it off. The original file is safe either way (variants are best-effort and
   the UI falls back to a file-type icon), but consider moving it to a background
   job.
5. **`SHARE_LINK_SIGNING_SECRET` rotation invalidates every existing share link
   and unlock cookie.** No rotation strategy exists. Fine now; document it before
   you have live links in the wild.
6. **1 GB storage ceiling** (see trade-off above) — reachable with a few hundred
   photos.

## Next Steps

1. Create the Supabase project. Put real values in `.env.local` and generate a
   real `SHARE_LINK_SIGNING_SECRET`
   (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
2. Apply `supabase/migrations/0001 → 0004` in order. Confirm the
   `vaultra-assets` bucket exists and is **private**.
3. Regenerate `types/database.ts` from the live project and re-run
   `npm run typecheck` to catch any drift from the hand-authored version.
4. Walk the core loop manually against live infra: sign up → create org →
   upload an image → confirm a thumbnail appears → tag it → search for it →
   create a share link → open the portal in a private window → revoke it and
   confirm access stops.
5. **Verify storage RLS by hand**: sign in as Org A and attempt to read an Org B
   object path directly. It must fail.
6. Wire a transactional email provider so invites send themselves.
7. Move the share-password attempt counter to durable storage.

## Notes for Next Session

- Planning docs are complete at repo root (`01`–`05` + this file). Note they live
  at the **root**, not in `docs/`, and the build log is `memory.md`, not
  `docs/memory.md`.
- `03-security-access.md` in this repo is byte-identical to a Jul 23 snapshot,
  while `02`, `04` and `05` were revised Jul 30. It was supplied deliberately
  after being flagged. Worth a re-read to confirm nothing in the Jul 30 pass
  contradicts it.
- Design direction locked: "Fortified Archive" — ink-navy `#1B2A4A` + brass
  `#C9A24B`, Fraunces / IBM Plex Sans / IBM Plex Mono.
- Useful commands: `npm run verify` (everything), `npm run db:test` (schema, RLS,
  search, permission parity, contrast, core loop), `npm run dev`.
- `supabase/tests/permission-parity.test.mjs` guards the duplicated permission
  matrix (`lib/permissions.ts` vs `has_permission()` in SQL) — 90 role/permission
  pairs. If you touch either copy, run it.
- Scope discipline held: no AI auto-tagging, SSO/SAML, approval workflows,
  comments, analytics, or third-party integrations.
