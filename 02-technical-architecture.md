# Technical Architecture Document — Vaultra

## Tech Stack
| Layer | Choice | Version | Why |
|---|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | Next.js 14+, TS 5+, Tailwind 3+ | Single framework for both frontend and backend keeps a solo/AI-assisted build coherent; App Router gives server components for fast, data-heavy asset grids; Tailwind speeds up consistent UI without a heavy design system |
| Backend | Next.js API Routes / Server Actions | Next.js 14+ | No separate backend service to deploy/maintain; Server Actions handle mutations (upload, tag, share-link creation) directly from React without hand-rolled REST boilerplate |
| Database | PostgreSQL via Supabase | Supabase (managed Postgres 15) | Relational model fits asset/folder/permission structure well; Supabase bundles auth, row-level security, and realtime for near-zero infra cost at MVP scale, with a clear upgrade path to dedicated Postgres later |
| Auth | Supabase Auth | Supabase Auth (GoTrue) | Email/password + invite flows out of the box; JWT-based sessions integrate directly with Postgres RLS for enforcing multi-tenant isolation at the database layer, not just the app layer |
| File Storage | Cloudflare R2 | — | S3-compatible object storage with no egress fees, which matters once asset libraries and share-link traffic grow; keeps storage cost predictable on a bootstrapped budget |
| Image Processing / Delivery | `sharp` (server-side) + Next.js Image Optimization | sharp 0.33+, Next.js built-in | Fully free alternative to Cloudflare Images: `sharp` generates thumbnail/preview variants at upload time and stores them in R2 alongside the original; Next.js `<Image>` and its built-in optimization API handle on-the-fly resizing/caching in the app, at no additional cost on Vercel's free tier or locally |
| Hosting | Vercel | — | Native Next.js deployment, zero-config CI/CD, generous free tier for MVP traffic, scales predictably as usage grows |

## File & Folder Structure
```
vaultra/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   └── invite/[token]/
│   ├── (dashboard)/
│   │   ├── layout.tsx              # authenticated shell (sidebar, topbar)
│   │   ├── page.tsx                 # home / recent assets
│   │   ├── library/
│   │   │   ├── [folderId]/page.tsx  # folder browse view
│   │   │   └── asset/[assetId]/page.tsx  # asset detail view
│   │   ├── collections/
│   │   ├── search/
│   │   ├── shares/                  # manage active share links
│   │   ├── settings/
│   │   │   ├── organization/
│   │   │   ├── users/
│   │   │   └── branding/
│   ├── (public)/
│   │   └── share/[token]/page.tsx   # external branded portal, no auth
│   └── api/
│       ├── upload/route.ts
│       ├── assets/[id]/route.ts
│       ├── share-links/route.ts
│       └── webhooks/                # Supabase/Cloudflare webhooks if needed
├── components/
│   ├── ui/                          # shared primitives (button, input, modal, card)
│   ├── asset/                       # AssetCard, AssetGrid, AssetPreview, VersionHistory
│   ├── folder/                      # FolderTree, FolderBreadcrumb
│   └── share/                       # ShareLinkModal, BrandedPortalShell
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # browser client
│   │   ├── server.ts                 # server component/action client
│   │   └── admin.ts                  # service-role client (server-only, never exposed)
│   ├── r2/
│   │   ├── client.ts                 # S3-compatible client config
│   │   ├── upload.ts                 # presigned URL generation
│   │   └── thumbnails.ts             # sharp-based thumbnail/preview variant generation, written back to R2
│   ├── permissions.ts                # role → permission mapping helpers
│   └── validation/                    # zod schemas for forms/API payloads
├── types/
│   └── database.ts                    # generated Supabase types
├── supabase/
│   ├── migrations/                    # SQL migration files
│   └── seed.sql
├── public/
├── .env.local                         # local-only, never committed
└── middleware.ts                      # route protection, session refresh
```
Server Actions live alongside the routes that use them (e.g. `app/(dashboard)/library/actions.ts`) rather than in a single monolithic actions file, so each feature area stays self-contained.

## Database Schema

### organizations
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | text | |
| plan | text | e.g. 'trial', 'enterprise' — future billing hook |
| logo_url | text, nullable | R2-served URL, resized via `sharp` at upload time |
| brand_primary_color | text, nullable | hex, used on branded share portal |
| brand_secondary_color | text, nullable | hex |
| created_at | timestamptz | default now() |

### users
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | matches Supabase `auth.users.id` |
| organization_id | uuid, FK → organizations.id | |
| full_name | text | |
| email | text | mirrored from auth.users for query convenience |
| role | text | 'owner', 'admin', 'manager', 'contributor', 'viewer' |
| avatar_url | text, nullable | |
| status | text | 'active', 'invited', 'deactivated' |
| created_at | timestamptz | default now() |

### folders
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| organization_id | uuid, FK → organizations.id | |
| parent_folder_id | uuid, FK → folders.id, nullable | null = root level |
| name | text | |
| created_by | uuid, FK → users.id | |
| created_at | timestamptz | default now() |

### collections
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| organization_id | uuid, FK → organizations.id | |
| name | text | |
| description | text, nullable | |
| created_by | uuid, FK → users.id | |
| created_at | timestamptz | default now() |

### assets
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| organization_id | uuid, FK → organizations.id | |
| folder_id | uuid, FK → folders.id, nullable | null = unfiled |
| filename | text | current display filename |
| file_type | text | mime type |
| file_size_bytes | bigint | |
| r2_key | text | current version's object key in R2 |
| cdn_url | text | R2-served URL for the generated thumbnail/preview variant (produced by `sharp` at upload time; original file remains the source of truth in `r2_key`) |
| current_version | integer | default 1 |
| status | text | 'active', 'archived', 'deleted' (soft delete) |
| uploaded_by | uuid, FK → users.id | |
| metadata | jsonb | custom field values, schema defined per-org (see metadata_fields) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### asset_versions
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| asset_id | uuid, FK → assets.id | |
| version_number | integer | |
| r2_key | text | object key for this specific version |
| file_size_bytes | bigint | |
| uploaded_by | uuid, FK → users.id | |
| created_at | timestamptz | default now() |

### collection_assets (join table)
| Field | Type | Notes |
|---|---|---|
| collection_id | uuid, FK → collections.id | composite PK with asset_id |
| asset_id | uuid, FK → assets.id | |
| added_by | uuid, FK → users.id | |
| added_at | timestamptz | default now() |

### tags
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| organization_id | uuid, FK → organizations.id | |
| name | text | unique per organization |

### asset_tags (join table)
| Field | Type | Notes |
|---|---|---|
| asset_id | uuid, FK → assets.id | composite PK with tag_id |
| tag_id | uuid, FK → tags.id | |

### metadata_fields
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| organization_id | uuid, FK → organizations.id | |
| field_key | text | key used inside assets.metadata jsonb |
| label | text | display label |
| field_type | text | 'text', 'number', 'date', 'select' |
| options | jsonb, nullable | for 'select' type |

### share_links
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| organization_id | uuid, FK → organizations.id | |
| token | text, unique | random URL-safe token, indexed |
| asset_id | uuid, FK → assets.id, nullable | one of asset_id/folder_id/collection_id set |
| folder_id | uuid, FK → folders.id, nullable | |
| collection_id | uuid, FK → collections.id, nullable | |
| password_hash | text, nullable | bcrypt hash if password-protected |
| allow_download | boolean | default true |
| expires_at | timestamptz | required — no permanent public links in v1 |
| revoked_at | timestamptz, nullable | manual revocation |
| created_by | uuid, FK → users.id | |
| created_at | timestamptz | default now() |
| access_count | integer | default 0, incremented on each view |

**Relationships summary:** an organization owns users, folders, collections, assets, tags, metadata_fields, and share_links. Assets belong to one folder and can belong to many collections (via collection_assets) and many tags (via asset_tags). Every asset re-upload creates a row in asset_versions rather than overwriting history. Share links point to exactly one of an asset, folder, or collection, and always carry an expiration.

## Environment & Config Notes
| Variable | Purpose | Never hardcode? |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | Yes — env only |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Public/anon client key (safe for browser, RLS-restricted) | Yes — env only |
| SUPABASE_SERVICE_ROLE_KEY | Server-only elevated key, bypasses RLS — used sparingly for admin ops | Yes — never exposed to client, server env only |
| R2_ACCOUNT_ID | Cloudflare account ID for R2 | Yes |
| R2_ACCESS_KEY_ID | R2 S3-compatible access key | Yes |
| R2_SECRET_ACCESS_KEY | R2 S3-compatible secret | Yes |
| R2_BUCKET_NAME | Target bucket for asset storage | Yes |
| NEXT_PUBLIC_APP_URL | Base app URL, used to build share-link URLs | No — safe to keep in env but not sensitive |
| SHARE_LINK_SIGNING_SECRET | Secret used to sign/validate share tokens | Yes |

All secrets live in Vercel's environment variable settings (per environment: development/preview/production) and local `.env.local`, which is git-ignored. The service-role Supabase key is only ever used inside server-only code paths (Server Actions, API routes) — never in a client component or exposed bundle.
