-- ============================================================================
-- Vaultra — TICKET-013: search & filter support
--
-- Implemented as a SQL function rather than assembled client-side so that
-- "AND logic across filter types" is expressed once, in one place. The function
-- is SECURITY INVOKER (the default) on purpose: RLS on public.assets still
-- applies, so search can never return another organization's rows.
-- ============================================================================

-- Mirrors assetKind() in lib/utils.ts. Kept in SQL so filtering by file type can
-- happen in the database instead of over-fetching and filtering in JS.
create or replace function public.asset_kind(mime_type text)
returns text
language sql
immutable
as $$
  select case
    when mime_type is null then 'other'
    when mime_type like 'image/%' then 'image'
    when mime_type like 'video/%' then 'video'
    when mime_type = 'application/pdf' then 'pdf'
    when mime_type like 'text/%'
      or mime_type like '%word%'
      or mime_type like '%spreadsheet%'
      or mime_type like '%presentation%'
      or mime_type like '%excel%'
      or mime_type like '%powerpoint%' then 'document'
    when mime_type like '%photoshop%'
      or mime_type like '%illustrator%'
      or mime_type like '%sketch%'
      or mime_type = 'application/postscript' then 'design'
    else 'other'
  end;
$$;

-- Escapes LIKE metacharacters so a user searching for "50%" or "logo_v2" gets
-- literal matches instead of accidental wildcards.
create or replace function public.escape_like(input text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(input, '\', '\\'), '%', '\%'), '_', '\_');
$$;

/**
 * Full-text-ish search across filename, tag names and metadata values, with
 * AND-combined facets.
 *
 * Semantics chosen deliberately:
 *  - p_query matches filename OR any tag name OR any metadata value (a broad
 *    "find the thing" search).
 *  - p_tag_ids uses AND semantics: an asset must carry every selected tag.
 *    Selecting more tags narrows results, which is what a filter panel implies.
 *  - Soft-deleted assets are always excluded.
 */
create or replace function public.search_assets(
  p_query         text        default null,
  p_folder_id     uuid        default null,
  p_file_kinds    text[]      default null,
  p_tag_ids       uuid[]      default null,
  p_uploader_id   uuid        default null,
  p_date_from     timestamptz default null,
  p_date_to       timestamptz default null,
  p_collection_id uuid        default null
)
returns setof public.assets
language sql
stable
as $$
  with q as (
    select
      case
        when p_query is null or length(trim(p_query)) = 0 then null
        else '%' || public.escape_like(trim(p_query)) || '%'
      end as pattern
  )
  select a.*
  from public.assets a, q
  where a.status = 'active'
    -- Tenant isolation is enforced by RLS on public.assets, not repeated here.
    and (p_folder_id is null or a.folder_id = p_folder_id)
    and (p_uploader_id is null or a.uploaded_by = p_uploader_id)
    and (p_date_from is null or a.created_at >= p_date_from)
    and (p_date_to is null or a.created_at < p_date_to)
    and (
      p_file_kinds is null
      or cardinality(p_file_kinds) = 0
      or public.asset_kind(a.file_type) = any (p_file_kinds)
    )
    and (
      p_collection_id is null
      or exists (
        select 1 from public.collection_assets ca
        where ca.asset_id = a.id
          and ca.collection_id = p_collection_id
      )
    )
    and (
      p_tag_ids is null
      or cardinality(p_tag_ids) = 0
      or (
        select count(distinct at.tag_id)
        from public.asset_tags at
        where at.asset_id = a.id
          and at.tag_id = any (p_tag_ids)
      ) = cardinality(p_tag_ids)
    )
    and (
      q.pattern is null
      or a.filename ilike q.pattern
      or exists (
        select 1
        from public.asset_tags at
        join public.tags t on t.id = at.tag_id
        where at.asset_id = a.id
          and t.name ilike q.pattern
      )
      or exists (
        select 1
        from jsonb_each_text(a.metadata) meta
        where meta.value ilike q.pattern
      )
    )
  order by a.created_at desc;
$$;

grant execute on function public.asset_kind(text) to authenticated, service_role;
grant execute on function public.escape_like(text) to authenticated, service_role;
grant execute on function public.search_assets(
  text, uuid, text[], uuid[], uuid, timestamptz, timestamptz, uuid
) to authenticated, service_role;
