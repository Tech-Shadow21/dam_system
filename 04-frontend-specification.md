# Frontend Specification Document — Vaultra

## Design Direction
**"Fortified Archive"** — a refined, trustworthy aesthetic that borrows from vault architecture and archival institutions rather than generic SaaS-dashboard blue. Deep ink-navy and warm paper tones dominate, with a single sharp brass-gold accent reserved for what matters (primary actions, active states, brand touches). A distinctive serif carries the voice and weight of the product; a clean, slightly technical sans handles the day-to-day UI. The result should feel like a private, well-run archive — precise, a little formal, quietly premium — not a playful consumer app.

## Color Palette
| Purpose | Hex |
|---|---|
| Primary (brand / primary actions) | #1B2A4A |
| Accent (brass — sparing use: active states, highlights, links) | #C9A24B |
| Background (app canvas) | #F7F6F3 |
| Surface (cards, panels, modals) | #FFFFFF |
| Text — Primary | #1A1D23 |
| Text — Secondary | #5B6472 |
| Border / Divider | #E2E0DA |
| Error | #C4453D |
| Success | #2F7A5C |
| Warning | #C98A2C |
| Dark mode — Background | #0E1116 |
| Dark mode — Surface | #161B22 |
| Dark mode — Text Primary | #E8E6E1 |

Dominant palette is navy + warm paper neutrals; brass gold is used deliberately and sparingly (primary CTA hover, active nav item, selection states, the branded share-portal accent) — never as a flood color. Dark mode uses the same navy/brass logic inverted, for users who prefer it in the dashboard chrome; the external share portal always renders in the organization's own brand colors (set in org settings), falling back to the light Vaultra palette if unset.

## Typography
| Use | Font | Size |
|---|---|---|
| Display / Page Titles | Fraunces (variable serif, weight 500–600) | 32–40px |
| Section Headings | Fraunces, weight 500 | 20–24px |
| Body / UI text | IBM Plex Sans, weight 400–500 | 14–16px |
| Button Text | IBM Plex Sans, weight 500, slight letter-spacing (0.01em) | 14px |
| Metadata / IDs / Technical Labels (file size, tokens, version numbers) | IBM Plex Mono, weight 400 | 12–13px |
| Captions / Timestamps | IBM Plex Sans, weight 400 | 12px |

Fraunces gives the product a distinctive, slightly editorial voice at moments that matter (page titles, empty states, the login screen, the branded share portal headline) without slowing down dense UI, which stays in IBM Plex Sans. IBM Plex Mono is used specifically for anything that reads as data — file sizes, version numbers, share tokens, timestamps — reinforcing the "archival record" feel.

## Component Styles

### Buttons
- **Primary:** solid `#1B2A4A` background, white text, 6px radius, subtle shadow on hover, background shifts to `#C9A24B` with dark navy text on hover for the single "hero" action per screen (e.g. "Upload," "Create Share Link").
- **Secondary:** 1px `#E2E0DA` border, white/transparent background, `#1A1D23` text; border darkens on hover.
- **Destructive:** `#C4453D` text on transparent, filled solid on hover — reserved for delete/revoke actions, always paired with a confirmation step.
- **Sizing:** 40px height default, 32px for compact/inline contexts (table rows, toolbars). Consistent 16px horizontal padding.

### Inputs
- 1px `#E2E0DA` border, 6px radius, 40px height, `#FFFFFF` background. Focus state: border shifts to `#1B2A4A` with a soft 2px navy-at-10%-opacity ring — no default browser blue outline. Error state: border and helper text in `#C4453D`. Labels sit above the field in IBM Plex Sans 13px, `#5B6472`.

### Cards
- Asset cards: `#FFFFFF` surface, 8px radius, 1px `#E2E0DA` border (no heavy shadow at rest — shadow only appears on hover/drag, keeping the grid calm at scale). Thumbnail fills the top, metadata strip (filename, file type icon, tag chips) below in Plex Sans. Selected state uses a 2px `#C9A24B` border, not a color fill, to keep multi-select grids legible.
- Folder cards: more compact, icon + name + item count, same border treatment, no thumbnail.

### Modals
- Centered, `#FFFFFF` surface, 12px radius, generous internal padding (24–32px). Title in Fraunces 20px. Backdrop is `#1A1D23` at 40% opacity — no blur, keeping it snappy. Share-link and delete-confirmation modals are the two most-used; both keep primary action on the right, cancel/secondary on the left, consistent across the app.

## Spacing & Layout Rules
- Base spacing unit: **4px**, used in multiples of 4/8/12/16/24/32/48 throughout — no arbitrary values.
- App shell: fixed 240px left sidebar (navy `#1B2A4A` background, light text, brass accent for the active item) + top bar (search, user menu) + fluid main content area with 32px outer padding.
- Asset grid: responsive CSS grid, minimum card width 200px, 16px gutter, auto-fill columns.
- Content max-width in single-column contexts (settings pages, forms): 720px, to keep line lengths and form scanning comfortable.
- Consistent 24px vertical rhythm between major sections on any given page.

## API & Integration Spec

### Supabase (Database, Auth, Realtime)
- **Purpose in this app:** Primary data store for organizations, users, folders, assets, tags, metadata, and share links; handles authentication (email/password, invites) and enforces multi-tenant isolation via row-level security.
- **Endpoints used:** Supabase JS client — `auth.signUp`, `auth.signInWithPassword`, `auth.admin.inviteUserByEmail` (server-only), standard Postgrest queries/mutations against the schema in `02-technical-architecture.md`, optionally Supabase Realtime channels for live asset-grid updates when multiple users edit the same folder.
- **Data sent:** User credentials/invite payloads, CRUD payloads for assets/folders/tags/share_links scoped to the caller's organization.
- **Data received:** Session/JWT on auth, row data respecting RLS policies.

### Cloudflare R2 (Object Storage)
- **Purpose in this app:** Stores the actual asset binary files (all versions), separate from metadata which lives in Postgres.
- **Endpoints used:** S3-compatible API — presigned PUT URLs generated server-side for direct-from-browser uploads (avoids routing large files through the Next.js server), presigned/authenticated GET for private asset retrieval where needed.
- **Data sent:** File binary (via presigned URL, browser → R2 directly), object key following the pattern `org/{organization_id}/assets/{asset_id}/v{version_number}/{filename}`.
- **Data received:** Upload success confirmation (ETag), which is then written to the `asset_versions` row.

### `sharp` + Next.js Image Optimization (Image Processing / Delivery)
- **Purpose in this app:** Fully free replacement for Cloudflare Images. Generates thumbnail and preview variants of image assets at upload time and serves them efficiently in the UI, at zero additional infrastructure cost.
- **How it works:** After an image asset lands in R2, a server-side step uses the `sharp` library to generate resized variants (thumbnail, preview) and writes them back to R2 under a predictable key pattern (e.g. `org/{organization_id}/assets/{asset_id}/variants/{variant}.webp`). The resulting R2 URL is stored as `cdn_url` on the asset record. In the UI, these variants are served through Next.js's built-in `<Image>` component, which handles further on-the-fly resizing and caching for free on Vercel's free tier and locally.
- **Data sent:** Original image buffer (server-side, immediately after upload) to `sharp` for processing; resized output written to R2.
- **Data received:** Local file paths/URLs for each generated variant, written to the `assets.cdn_url` field.
- **Scope note:** PDF and video assets don't get `sharp`-generated preview thumbnails in MVP — they use a generic file-type icon in grid/card views instead. Real preview-frame generation for those types can be added post-MVP without a rework.

### Vercel (Hosting)
- **Purpose in this app:** Hosts the Next.js application (frontend + API routes/Server Actions), handles CI/CD from the git repository, manages environment variables per environment.
- **Endpoints used:** N/A (deployment platform, not a runtime API called from app code).
- **Data sent/received:** N/A.
