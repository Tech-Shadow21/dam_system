-- ============================================================================
-- Vaultra — optional development seed.
--
-- Creates a demo organization with a starter folder structure, tag vocabulary
-- and metadata fields. It deliberately does NOT create users: users must exist
-- in auth.users first, which happens through the real signup/invite flow.
--
-- Apply after the migrations:
--   psql "$DATABASE_URL" -f supabase/seed.sql
-- ============================================================================

do $$
declare
  demo_org uuid;
  brand_folder uuid;
begin
  select id into demo_org from public.organizations where name = 'Vaultra Demo Co.';

  if demo_org is null then
    insert into public.organizations (name, plan, brand_primary_color, brand_secondary_color)
    values ('Vaultra Demo Co.', 'trial', '#1B2A4A', '#C9A24B')
    returning id into demo_org;
  end if;

  -- Starter folder structure (App Flow step 2: "defines initial folder structure").
  insert into public.folders (organization_id, name)
  select demo_org, f.name
  from (values ('Brand Assets'), ('Campaigns'), ('Product Photography'), ('Templates')) as f(name)
  where not exists (
    select 1 from public.folders
    where organization_id = demo_org and name = f.name and parent_folder_id is null
  );

  select id into brand_folder
  from public.folders
  where organization_id = demo_org and name = 'Brand Assets' and parent_folder_id is null
  limit 1;

  insert into public.folders (organization_id, parent_folder_id, name)
  select demo_org, brand_folder, f.name
  from (values ('Logos'), ('Typography'), ('Color Palettes')) as f(name)
  where not exists (
    select 1 from public.folders
    where organization_id = demo_org and parent_folder_id = brand_folder and name = f.name
  );

  -- Controlled-vocabulary starter tags.
  insert into public.tags (organization_id, name)
  select demo_org, t.name
  from (values
    ('brand-approved'), ('needs-review'), ('logo'), ('photography'),
    ('social'), ('print'), ('web'), ('archived-campaign')
  ) as t(name)
  where not exists (
    select 1 from public.tags
    where organization_id = demo_org and lower(name) = lower(t.name)
  );

  -- Example custom metadata fields (TICKET-011).
  insert into public.metadata_fields (organization_id, field_key, label, field_type, options)
  select demo_org, m.field_key, m.label, m.field_type, m.options::jsonb
  from (values
    ('campaign',    'Campaign',       'text',   null),
    ('usage_rights','Usage Rights',   'select', '["Unrestricted","Internal only","Licensed - expires","Do not use"]'),
    ('expires_on',  'Rights Expire',  'date',   null),
    ('photographer','Photographer',   'text',   null)
  ) as m(field_key, label, field_type, options)
  where not exists (
    select 1 from public.metadata_fields
    where organization_id = demo_org and field_key = m.field_key
  );

  raise notice 'Seeded demo organization %', demo_org;
end $$;
