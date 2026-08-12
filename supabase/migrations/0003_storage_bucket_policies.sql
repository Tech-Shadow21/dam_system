-- ============================================================================
-- Vaultra — Supabase Storage bucket + RLS policies
--
-- Storage access is scoped by organization_id using the same has_permission()
-- gate as the Postgres tables, rather than relying on the object path being
-- hard to guess. Object paths follow:
--   org/{organization_id}/assets/{asset_id}/v{version_number}/{filename}
--   org/{organization_id}/assets/{asset_id}/variants/{variant}.webp
--   org/{organization_id}/branding/{filename}
--
-- storage.foldername(name) returns the path segments excluding the filename, so
-- segment [1] is the literal 'org' and segment [2] is the organization_id.
--
-- NOTE: the bucket id is written literally below because migrations cannot read
-- process env. It must match SUPABASE_STORAGE_BUCKET. If you change that env
-- var, change it here too — this is the single place it appears in SQL.
-- ============================================================================

-- Private bucket: nothing is world-readable. External share-portal downloads
-- are served through short-lived signed URLs minted server-side only after the
-- share token, expiry and revocation have been validated.
insert into storage.buckets (id, name, public, file_size_limit)
values (
  'vaultra-assets',
  'vaultra-assets',
  false,
  -- 5 GB, matching the documented upload ceiling in 03-security-access.md.
  5368709120
)
on conflict (id) do nothing;

-- Helper: the organization that owns a given storage object path.
create or replace function public.storage_object_org(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  segments text[];
begin
  segments := storage.foldername(object_name);
  -- Expect 'org/<uuid>/...'; anything else is not a Vaultra-managed path.
  if array_length(segments, 1) is null
     or array_length(segments, 1) < 2
     or segments[1] <> 'org'
  then
    return null;
  end if;
  begin
    return segments[2]::uuid;
  exception when invalid_text_representation then
    return null;
  end;
end;
$$;

grant execute on function public.storage_object_org(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects.
--
-- The `anon` role is deliberately granted nothing: an unauthenticated visitor
-- can never read from the bucket directly, only via a signed URL.
-- ---------------------------------------------------------------------------

drop policy if exists vaultra_objects_select on storage.objects;
create policy vaultra_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vaultra-assets'
    and public.storage_object_org(name) = public.current_organization_id()
  );

drop policy if exists vaultra_objects_insert on storage.objects;
create policy vaultra_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vaultra-assets'
    and public.storage_object_org(name) = public.current_organization_id()
    and public.has_permission(auth.uid(), 'asset:create')
  );

drop policy if exists vaultra_objects_update on storage.objects;
create policy vaultra_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vaultra-assets'
    and public.storage_object_org(name) = public.current_organization_id()
    and public.has_permission(auth.uid(), 'asset:update_own')
  )
  with check (
    bucket_id = 'vaultra-assets'
    and public.storage_object_org(name) = public.current_organization_id()
  );

drop policy if exists vaultra_objects_delete on storage.objects;
create policy vaultra_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vaultra-assets'
    and public.storage_object_org(name) = public.current_organization_id()
    and public.has_permission(auth.uid(), 'asset:delete_own')
  );
