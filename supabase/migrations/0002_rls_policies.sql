-- ============================================================================
-- Vaultra — TICKET-003: Row-Level Security
--
-- Implements the model in 03-security-access.md:
--  1. Tenant isolation: every org-scoped table requires
--     organization_id = (the caller's organization).
--  2. Role-gated writes via has_permission(auth.uid(), '<permission>'),
--     referenced directly in the policies, so a Viewer's session cannot execute
--     a write at the database layer even if the UI or a Server Action is bypassed.
--
-- Deviation from 03-security-access.md (documented in memory.md): that document
-- lists 9 org-scoped tables and omits `collection_assets`, which carries no
-- organization_id — exactly like `asset_versions` and `asset_tags`, which it does
-- list. Leaving it unprotected would be a genuine cross-tenant read/write hole,
-- so RLS is enabled on all 11 tables. Tables without their own organization_id
-- inherit scope through a join on their parent, as the document prescribes for
-- asset_versions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions
--
-- All three are SECURITY DEFINER on purpose. They read public.users, which is
-- itself RLS-protected; a plain (invoker) function would recurse infinitely when
-- evaluating the policy ON public.users. SECURITY DEFINER reads the row as the
-- function owner, breaking the cycle. search_path is pinned so the definer
-- context cannot be hijacked by a caller-controlled search_path.
-- ---------------------------------------------------------------------------

-- Returns the caller's organization, or NULL when there is no active membership.
-- A deactivated user resolves to NULL, which makes every policy below fail
-- closed — this is what makes "deactivating a user revokes their access"
-- (TICKET-018) true at the database layer, not just in the UI.
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id
  from public.users
  where id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.users
  where id = auth.uid()
    and status = 'active'
  limit 1;
$$;

/**
 * Role -> permission mapping, mirroring the table in 03-security-access.md.
 *
 * Permissions ending in `_any` apply org-wide; `_own` variants are paired with an
 * ownership predicate in the policy itself (Contributors may act on what they
 * uploaded, never on other people's assets).
 *
 * Note on Contributor delete: the role's "Can Do" column does not list delete,
 * but its "Cannot Do" column says "edit or delete assets uploaded by others",
 * which only makes sense if deleting one's own upload is permitted. Read as
 * asset:delete_own. Flagged in memory.md.
 */
create or replace function public.has_permission(user_id uuid, permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  user_role text;
begin
  select role into user_role
  from public.users
  where id = user_id
    and status = 'active'
  limit 1;

  if user_role is null then
    return false;
  end if;

  return case permission
    -- Assets
    when 'asset:create'            then user_role in ('owner','admin','manager','contributor')
    when 'asset:update_any'        then user_role in ('owner','admin','manager')
    when 'asset:update_own'        then user_role in ('owner','admin','manager','contributor')
    when 'asset:delete_any'        then user_role in ('owner','admin','manager')
    when 'asset:delete_own'        then user_role in ('owner','admin','manager','contributor')

    -- Folder structure is managed org-wide; Contributors are excluded.
    when 'folder:manage'           then user_role in ('owner','admin','manager')
    when 'collection:manage'       then user_role in ('owner','admin','manager','contributor')

    -- Org-wide controlled vocabulary vs. tagging an individual asset.
    when 'tag:manage'              then user_role in ('owner','admin','manager')
    when 'asset_tag:write_any'     then user_role in ('owner','admin','manager')
    when 'asset_tag:write_own'     then user_role in ('owner','admin','manager','contributor')

    when 'metadata_field:manage'   then user_role in ('owner','admin','manager')

    -- Share links
    when 'share_link:create'       then user_role in ('owner','admin','manager','contributor')
    when 'share_link:manage_any'   then user_role in ('owner','admin','manager')
    when 'share_link:manage_own'   then user_role in ('owner','admin','manager','contributor')

    -- Administration
    when 'user:manage'             then user_role in ('owner','admin')
    when 'org:update'              then user_role in ('owner','admin')
    when 'org:delete'              then user_role = 'owner'
    when 'billing:manage'          then user_role = 'owner'

    else false
  end;
end;
$$;

revoke all on function public.has_permission(uuid, text) from public;
grant execute on function public.has_permission(uuid, text) to authenticated, service_role;
grant execute on function public.current_organization_id() to authenticated, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. FORCE so that even the table owner is subject to
-- policies (defence against accidentally running app queries as owner).
-- ---------------------------------------------------------------------------
alter table public.organizations     enable row level security;
alter table public.users             enable row level security;
alter table public.folders           enable row level security;
alter table public.collections       enable row level security;
alter table public.assets            enable row level security;
alter table public.asset_versions    enable row level security;
alter table public.collection_assets enable row level security;
alter table public.tags              enable row level security;
alter table public.asset_tags        enable row level security;
alter table public.metadata_fields   enable row level security;
alter table public.share_links       enable row level security;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select using (id = public.current_organization_id());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update using (
    id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'org:update')
  )
  with check (
    id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'org:update')
  );

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations
  for delete using (
    id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'org:delete')
  );

-- No INSERT policy: organizations are created during signup through the
-- service-role client, which bypasses RLS. An authenticated session must never
-- be able to conjure a new tenant.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select using (organization_id = public.current_organization_id());

-- Admins/Owners may add members within their own org. Column-level protection
-- of `role`/`status` is enforced by the trigger further down, since RLS alone
-- cannot restrict which columns an UPDATE touches.
drop policy if exists users_insert on public.users;
create policy users_insert on public.users
  for insert with check (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'user:manage')
  );

drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update using (
    organization_id = public.current_organization_id()
    and (id = auth.uid() or public.has_permission(auth.uid(), 'user:manage'))
  )
  with check (
    organization_id = public.current_organization_id()
    and (id = auth.uid() or public.has_permission(auth.uid(), 'user:manage'))
  );

-- Users are deactivated, not deleted (audit trail on uploads must survive).
drop policy if exists users_delete on public.users;
create policy users_delete on public.users
  for delete using (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'user:manage')
    and id <> auth.uid()
  );

-- ---------------------------------------------------------------------------
-- folders
-- ---------------------------------------------------------------------------
drop policy if exists folders_select on public.folders;
create policy folders_select on public.folders
  for select using (organization_id = public.current_organization_id());

drop policy if exists folders_insert on public.folders;
create policy folders_insert on public.folders
  for insert with check (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'folder:manage')
  );

drop policy if exists folders_update on public.folders;
create policy folders_update on public.folders
  for update using (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'folder:manage')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'folder:manage')
  );

drop policy if exists folders_delete on public.folders;
create policy folders_delete on public.folders
  for delete using (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'folder:manage')
  );

-- ---------------------------------------------------------------------------
-- collections
-- ---------------------------------------------------------------------------
drop policy if exists collections_select on public.collections;
create policy collections_select on public.collections
  for select using (organization_id = public.current_organization_id());

drop policy if exists collections_insert on public.collections;
create policy collections_insert on public.collections
  for insert with check (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'collection:manage')
  );

drop policy if exists collections_update on public.collections;
create policy collections_update on public.collections
  for update using (
    organization_id = public.current_organization_id()
    and (
      public.has_permission(auth.uid(), 'tag:manage')
      or (public.has_permission(auth.uid(), 'collection:manage') and created_by = auth.uid())
    )
  )
  with check (organization_id = public.current_organization_id());

drop policy if exists collections_delete on public.collections;
create policy collections_delete on public.collections
  for delete using (
    organization_id = public.current_organization_id()
    and (
      public.has_permission(auth.uid(), 'tag:manage')
      or (public.has_permission(auth.uid(), 'collection:manage') and created_by = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------
drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets
  for select using (organization_id = public.current_organization_id());

drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets
  for insert with check (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'asset:create')
    -- An uploader cannot attribute an upload to someone else.
    and (uploaded_by is null or uploaded_by = auth.uid())
  );

drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets
  for update using (
    organization_id = public.current_organization_id()
    and (
      public.has_permission(auth.uid(), 'asset:update_any')
      or (public.has_permission(auth.uid(), 'asset:update_own') and uploaded_by = auth.uid())
    )
  )
  with check (organization_id = public.current_organization_id());

drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets
  for delete using (
    organization_id = public.current_organization_id()
    and (
      public.has_permission(auth.uid(), 'asset:delete_any')
      or (public.has_permission(auth.uid(), 'asset:delete_own') and uploaded_by = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- asset_versions — organization scope inherited through the parent asset,
-- checked via a join, per 03-security-access.md.
-- ---------------------------------------------------------------------------
drop policy if exists asset_versions_select on public.asset_versions;
create policy asset_versions_select on public.asset_versions
  for select using (
    exists (
      select 1 from public.assets a
      where a.id = asset_versions.asset_id
        and a.organization_id = public.current_organization_id()
    )
  );

drop policy if exists asset_versions_insert on public.asset_versions;
create policy asset_versions_insert on public.asset_versions
  for insert with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_versions.asset_id
        and a.organization_id = public.current_organization_id()
        and (
          public.has_permission(auth.uid(), 'asset:update_any')
          or (public.has_permission(auth.uid(), 'asset:update_own') and a.uploaded_by = auth.uid())
        )
    )
  );

-- Version history is an audit trail: no UPDATE or DELETE policy exists, so
-- prior versions cannot be rewritten or erased by any authenticated role.
-- (Row removal happens only via ON DELETE CASCADE when the parent asset is
-- hard-deleted.)

-- ---------------------------------------------------------------------------
-- collection_assets — scope inherited through the parent collection
-- ---------------------------------------------------------------------------
drop policy if exists collection_assets_select on public.collection_assets;
create policy collection_assets_select on public.collection_assets
  for select using (
    exists (
      select 1 from public.collections c
      where c.id = collection_assets.collection_id
        and c.organization_id = public.current_organization_id()
    )
  );

drop policy if exists collection_assets_insert on public.collection_assets;
create policy collection_assets_insert on public.collection_assets
  for insert with check (
    public.has_permission(auth.uid(), 'collection:manage')
    and exists (
      select 1 from public.collections c
      where c.id = collection_assets.collection_id
        and c.organization_id = public.current_organization_id()
    )
    -- The asset must also belong to the caller's org: prevents linking a
    -- foreign asset into a local collection.
    and exists (
      select 1 from public.assets a
      where a.id = collection_assets.asset_id
        and a.organization_id = public.current_organization_id()
    )
  );

drop policy if exists collection_assets_delete on public.collection_assets;
create policy collection_assets_delete on public.collection_assets
  for delete using (
    public.has_permission(auth.uid(), 'collection:manage')
    and exists (
      select 1 from public.collections c
      where c.id = collection_assets.collection_id
        and c.organization_id = public.current_organization_id()
    )
  );

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
drop policy if exists tags_select on public.tags;
create policy tags_select on public.tags
  for select using (organization_id = public.current_organization_id());

-- Contributors need to create a tag while tagging their own asset, so tag
-- creation follows asset_tag:write_own rather than tag:manage.
drop policy if exists tags_insert on public.tags;
create policy tags_insert on public.tags
  for insert with check (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'asset_tag:write_own')
  );

drop policy if exists tags_update on public.tags;
create policy tags_update on public.tags
  for update using (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'tag:manage')
  )
  with check (organization_id = public.current_organization_id());

drop policy if exists tags_delete on public.tags;
create policy tags_delete on public.tags
  for delete using (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'tag:manage')
  );

-- ---------------------------------------------------------------------------
-- asset_tags — scope inherited through the parent asset
-- ---------------------------------------------------------------------------
drop policy if exists asset_tags_select on public.asset_tags;
create policy asset_tags_select on public.asset_tags
  for select using (
    exists (
      select 1 from public.assets a
      where a.id = asset_tags.asset_id
        and a.organization_id = public.current_organization_id()
    )
  );

drop policy if exists asset_tags_insert on public.asset_tags;
create policy asset_tags_insert on public.asset_tags
  for insert with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_tags.asset_id
        and a.organization_id = public.current_organization_id()
        and (
          public.has_permission(auth.uid(), 'asset_tag:write_any')
          or (public.has_permission(auth.uid(), 'asset_tag:write_own') and a.uploaded_by = auth.uid())
        )
    )
    and exists (
      select 1 from public.tags t
      where t.id = asset_tags.tag_id
        and t.organization_id = public.current_organization_id()
    )
  );

drop policy if exists asset_tags_delete on public.asset_tags;
create policy asset_tags_delete on public.asset_tags
  for delete using (
    exists (
      select 1 from public.assets a
      where a.id = asset_tags.asset_id
        and a.organization_id = public.current_organization_id()
        and (
          public.has_permission(auth.uid(), 'asset_tag:write_any')
          or (public.has_permission(auth.uid(), 'asset_tag:write_own') and a.uploaded_by = auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- metadata_fields
-- ---------------------------------------------------------------------------
drop policy if exists metadata_fields_select on public.metadata_fields;
create policy metadata_fields_select on public.metadata_fields
  for select using (organization_id = public.current_organization_id());

drop policy if exists metadata_fields_insert on public.metadata_fields;
create policy metadata_fields_insert on public.metadata_fields
  for insert with check (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'metadata_field:manage')
  );

drop policy if exists metadata_fields_update on public.metadata_fields;
create policy metadata_fields_update on public.metadata_fields
  for update using (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'metadata_field:manage')
  )
  with check (organization_id = public.current_organization_id());

drop policy if exists metadata_fields_delete on public.metadata_fields;
create policy metadata_fields_delete on public.metadata_fields
  for delete using (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'metadata_field:manage')
  );

-- ---------------------------------------------------------------------------
-- share_links
--
-- No policy grants the `anon` role any access. The public /share/[token] route
-- resolves links through the service-role client in a narrowly scoped server
-- function that validates token + expires_at + revoked_at and returns only the
-- referenced target — never a general query surface (03-security-access.md).
-- ---------------------------------------------------------------------------
drop policy if exists share_links_select on public.share_links;
create policy share_links_select on public.share_links
  for select using (organization_id = public.current_organization_id());

drop policy if exists share_links_insert on public.share_links;
create policy share_links_insert on public.share_links
  for insert with check (
    organization_id = public.current_organization_id()
    and public.has_permission(auth.uid(), 'share_link:create')
    and (created_by is null or created_by = auth.uid())
    -- Contributors may only share their own assets.
    and (
      public.has_permission(auth.uid(), 'share_link:manage_any')
      or (
        asset_id is not null
        and exists (
          select 1 from public.assets a
          where a.id = share_links.asset_id
            and a.organization_id = public.current_organization_id()
            and a.uploaded_by = auth.uid()
        )
      )
    )
  );

drop policy if exists share_links_update on public.share_links;
create policy share_links_update on public.share_links
  for update using (
    organization_id = public.current_organization_id()
    and (
      public.has_permission(auth.uid(), 'share_link:manage_any')
      or (public.has_permission(auth.uid(), 'share_link:manage_own') and created_by = auth.uid())
    )
  )
  with check (organization_id = public.current_organization_id());

drop policy if exists share_links_delete on public.share_links;
create policy share_links_delete on public.share_links
  for delete using (
    organization_id = public.current_organization_id()
    and (
      public.has_permission(auth.uid(), 'share_link:manage_any')
      or (public.has_permission(auth.uid(), 'share_link:manage_own') and created_by = auth.uid())
    )
  );

-- ============================================================================
-- Column-level and invariant protection that RLS alone cannot express
-- ============================================================================

/**
 * Prevents privilege escalation through the self-edit path in users_update.
 * A user may update their own profile (name, avatar), but changing `role`,
 * `status` or `organization_id` requires user:manage — and never on oneself,
 * so an Admin cannot quietly promote themselves to Owner.
 */
create or replace function public.enforce_user_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Service-role/admin paths (invite acceptance, signup bootstrap) run with no
  -- JWT subject; they are trusted and skip these checks.
  if auth.uid() is null then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'Cannot move a user between organizations';
  end if;

  if new.role is distinct from old.role then
    if not public.has_permission(auth.uid(), 'user:manage') then
      raise exception 'insufficient privilege: changing a role requires user management permission';
    end if;
    if new.id = auth.uid() then
      raise exception 'insufficient privilege: you cannot change your own role';
    end if;
  end if;

  if new.status is distinct from old.status then
    if not public.has_permission(auth.uid(), 'user:manage') then
      raise exception 'insufficient privilege: changing a status requires user management permission';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists users_enforce_field_changes on public.users;
create trigger users_enforce_field_changes
  before update on public.users
  for each row execute function public.enforce_user_field_changes();

/**
 * "An organization can never end up with zero owners" (03-security-access.md).
 * Enforced in the database so it holds regardless of which code path attempts
 * the change — including service-role admin operations.
 */
create or replace function public.enforce_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining_owners integer;
  target_org uuid;
begin
  target_org := coalesce(old.organization_id, new.organization_id);

  -- Only relevant when an active owner stops being one.
  if old.role = 'owner' and old.status = 'active' then
    if tg_op = 'DELETE'
       or new.role <> 'owner'
       or new.status <> 'active'
    then
      select count(*) into remaining_owners
      from public.users
      where organization_id = target_org
        and role = 'owner'
        and status = 'active'
        and id <> old.id;

      if remaining_owners = 0 then
        raise exception
          'This organization must always have at least one active Owner. Transfer ownership to another user first.';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists users_enforce_last_owner_update on public.users;
create trigger users_enforce_last_owner_update
  before update on public.users
  for each row execute function public.enforce_last_owner();

drop trigger if exists users_enforce_last_owner_delete on public.users;
create trigger users_enforce_last_owner_delete
  before delete on public.users
  for each row execute function public.enforce_last_owner();
