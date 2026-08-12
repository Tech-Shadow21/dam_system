-- ============================================================================
-- Vaultra — TICKET-002: Initial database schema
-- Mirrors the schema in 02-technical-architecture.md exactly (11 tables).
--
-- Storage note: `r2_key` columns are retained by name deliberately. Vaultra now
-- stores binaries in Supabase Storage rather than Cloudflare R2; these columns
-- hold the Supabase Storage object path. Keeping the name avoids a pointless
-- rename migration (see memory.md decisions log).
-- ============================================================================

-- gen_random_uuid() is core Postgres 13+, so uuid-ossp is not needed.
-- pgcrypto is enabled for crypt()/gen_salt(), used to hash share-link passwords
-- server-side (03-security-access.md specifies a bcrypt hash).
create extension if not exists "pgcrypto";
-- Trigram index support for fast ILIKE filename/tag search (TICKET-013).
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  -- Future billing hook; no billing logic in MVP.
  plan                    text not null default 'trial'
                            check (plan in ('trial', 'enterprise')),
  -- Supabase Storage-served URL, resized via sharp at upload time.
  logo_url                text,
  -- Hex colors used on the branded share portal.
  brand_primary_color     text check (brand_primary_color ~* '^#[0-9a-f]{6}$'),
  brand_secondary_color   text check (brand_secondary_color ~* '^#[0-9a-f]{6}$'),
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- users — mirrors auth.users, adds org membership and role
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  full_name         text not null default '',
  -- Mirrored from auth.users for query convenience.
  email             text not null,
  role              text not null default 'viewer'
                      check (role in ('owner', 'admin', 'manager', 'contributor', 'viewer')),
  avatar_url        text,
  status            text not null default 'invited'
                      check (status in ('active', 'invited', 'deactivated')),
  created_at        timestamptz not null default now()
);

create index if not exists users_organization_id_idx on public.users (organization_id);
create unique index if not exists users_email_org_unique
  on public.users (organization_id, lower(email));

-- ---------------------------------------------------------------------------
-- folders — nestable via parent_folder_id
-- ---------------------------------------------------------------------------
create table if not exists public.folders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  -- null = root level.
  parent_folder_id  uuid references public.folders(id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists folders_organization_id_idx on public.folders (organization_id);
create index if not exists folders_parent_folder_id_idx on public.folders (parent_folder_id);

-- ---------------------------------------------------------------------------
-- collections — flat saved groupings, independent of folder location
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  description       text,
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists collections_organization_id_idx on public.collections (organization_id);

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  -- null = unfiled. Deleting a folder unfiles its assets rather than destroying
  -- them, so a folder delete can never silently lose asset records.
  folder_id         uuid references public.folders(id) on delete set null,
  filename          text not null,
  -- mime type
  file_type         text not null,
  file_size_bytes   bigint not null default 0,
  -- Supabase Storage object path for the current version (see header note).
  r2_key            text not null,
  -- Storage URL for the sharp-generated thumbnail/preview variant. The original
  -- file remains the source of truth in r2_key.
  cdn_url           text,
  current_version   integer not null default 1 check (current_version >= 1),
  status            text not null default 'active'
                      check (status in ('active', 'archived', 'deleted')),
  uploaded_by       uuid references public.users(id) on delete set null,
  -- Custom field values keyed by metadata_fields.field_key.
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists assets_organization_id_idx on public.assets (organization_id);
create index if not exists assets_folder_id_idx on public.assets (folder_id);
create index if not exists assets_uploaded_by_idx on public.assets (uploaded_by);
create index if not exists assets_status_idx on public.assets (status);
create index if not exists assets_created_at_idx on public.assets (created_at desc);
-- Trigram index powering filename search.
create index if not exists assets_filename_trgm_idx
  on public.assets using gin (filename gin_trgm_ops);
-- Metadata value search.
create index if not exists assets_metadata_idx on public.assets using gin (metadata);

-- ---------------------------------------------------------------------------
-- asset_versions — every re-upload appends here, never overwrites history
-- ---------------------------------------------------------------------------
create table if not exists public.asset_versions (
  id                uuid primary key default gen_random_uuid(),
  asset_id          uuid not null references public.assets(id) on delete cascade,
  version_number    integer not null check (version_number >= 1),
  -- Supabase Storage object path for this specific version.
  r2_key            text not null,
  file_size_bytes   bigint not null default 0,
  uploaded_by       uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (asset_id, version_number)
);

create index if not exists asset_versions_asset_id_idx on public.asset_versions (asset_id);

-- ---------------------------------------------------------------------------
-- collection_assets (join)
-- ---------------------------------------------------------------------------
create table if not exists public.collection_assets (
  collection_id   uuid not null references public.collections(id) on delete cascade,
  asset_id        uuid not null references public.assets(id) on delete cascade,
  added_by        uuid references public.users(id) on delete set null,
  added_at        timestamptz not null default now(),
  primary key (collection_id, asset_id)
);

create index if not exists collection_assets_asset_id_idx on public.collection_assets (asset_id);

-- ---------------------------------------------------------------------------
-- tags — name unique per organization
-- ---------------------------------------------------------------------------
create table if not exists public.tags (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null check (length(trim(name)) > 0)
);

create unique index if not exists tags_org_name_unique
  on public.tags (organization_id, lower(name));
create index if not exists tags_name_trgm_idx
  on public.tags using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- asset_tags (join)
-- ---------------------------------------------------------------------------
create table if not exists public.asset_tags (
  asset_id  uuid not null references public.assets(id) on delete cascade,
  tag_id    uuid not null references public.tags(id) on delete cascade,
  primary key (asset_id, tag_id)
);

create index if not exists asset_tags_tag_id_idx on public.asset_tags (tag_id);

-- ---------------------------------------------------------------------------
-- metadata_fields — per-org custom field definitions
-- ---------------------------------------------------------------------------
create table if not exists public.metadata_fields (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  -- Key used inside assets.metadata jsonb.
  field_key         text not null check (field_key ~ '^[a-z0-9_]+$'),
  label             text not null check (length(trim(label)) > 0),
  field_type        text not null check (field_type in ('text', 'number', 'date', 'select')),
  -- Allowed values for 'select' type.
  options           jsonb
);

create unique index if not exists metadata_fields_org_key_unique
  on public.metadata_fields (organization_id, field_key);

-- ---------------------------------------------------------------------------
-- share_links — always carries an expiration; no permanent public links in v1
-- ---------------------------------------------------------------------------
create table if not exists public.share_links (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  -- Random URL-safe token, indexed.
  token             text not null unique,
  -- Exactly one of asset_id / folder_id / collection_id is set.
  asset_id          uuid references public.assets(id) on delete cascade,
  folder_id         uuid references public.folders(id) on delete cascade,
  collection_id     uuid references public.collections(id) on delete cascade,
  -- bcrypt hash when password-protected.
  password_hash     text,
  allow_download    boolean not null default true,
  -- Required — no permanent public links in v1.
  expires_at        timestamptz not null,
  revoked_at        timestamptz,
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  access_count      integer not null default 0,
  constraint share_links_exactly_one_target check (
    (case when asset_id is null then 0 else 1 end) +
    (case when folder_id is null then 0 else 1 end) +
    (case when collection_id is null then 0 else 1 end) = 1
  )
);

create index if not exists share_links_token_idx on public.share_links (token);
create index if not exists share_links_organization_id_idx on public.share_links (organization_id);
create index if not exists share_links_created_by_idx on public.share_links (created_by);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();
