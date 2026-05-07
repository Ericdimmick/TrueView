-- TrueView Supabase schema
-- Run this in the Supabase SQL Editor for the TrueView project.

create extension if not exists pgcrypto;

create table if not exists public.trueview_reports (
  remote_id uuid primary key default gen_random_uuid(),
  sync_space_id text not null default 'default',
  local_id text not null,
  device_id text,
  report jsonb not null,
  property_address text,
  client_name text,
  inspection_date text,
  report_status text,
  local_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (sync_space_id, local_id)
);

create table if not exists public.trueview_photos (
  remote_id uuid primary key default gen_random_uuid(),
  sync_space_id text not null default 'default',
  local_id text not null,
  report_local_id text not null,
  section_id text,
  item_id text,
  observation_id text,
  usage text,
  data_url text,
  storage_path text,
  device_id text,
  local_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (sync_space_id, local_id)
);

create index if not exists trueview_reports_sync_space_updated_idx
  on public.trueview_reports (sync_space_id, local_updated_at desc);

create index if not exists trueview_reports_property_idx
  on public.trueview_reports (sync_space_id, property_address);

create index if not exists trueview_photos_report_idx
  on public.trueview_photos (sync_space_id, report_local_id);

create or replace function public.trueview_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trueview_reports_touch_updated_at on public.trueview_reports;
create trigger trueview_reports_touch_updated_at
before update on public.trueview_reports
for each row execute function public.trueview_touch_updated_at();

drop trigger if exists trueview_photos_touch_updated_at on public.trueview_photos;
create trigger trueview_photos_touch_updated_at
before update on public.trueview_photos
for each row execute function public.trueview_touch_updated_at();

alter table public.trueview_reports enable row level security;
alter table public.trueview_photos enable row level security;

-- MVP personal-device policy:
-- TrueView sends x-trueview-sync-space-id from NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID.
-- Use a long random value for that variable in Vercel and on local devices.
drop policy if exists "TrueView report sync space read" on public.trueview_reports;
create policy "TrueView report sync space read"
on public.trueview_reports
for select
to anon, authenticated
using (
  sync_space_id = coalesce(nullif(current_setting('request.headers', true)::jsonb ->> 'x-trueview-sync-space-id', ''), 'default')
);

drop policy if exists "TrueView report sync space write" on public.trueview_reports;
create policy "TrueView report sync space write"
on public.trueview_reports
for all
to anon, authenticated
using (
  sync_space_id = coalesce(nullif(current_setting('request.headers', true)::jsonb ->> 'x-trueview-sync-space-id', ''), 'default')
)
with check (
  sync_space_id = coalesce(nullif(current_setting('request.headers', true)::jsonb ->> 'x-trueview-sync-space-id', ''), 'default')
);

drop policy if exists "TrueView photo sync space read" on public.trueview_photos;
create policy "TrueView photo sync space read"
on public.trueview_photos
for select
to anon, authenticated
using (
  sync_space_id = coalesce(nullif(current_setting('request.headers', true)::jsonb ->> 'x-trueview-sync-space-id', ''), 'default')
);

drop policy if exists "TrueView photo sync space write" on public.trueview_photos;
create policy "TrueView photo sync space write"
on public.trueview_photos
for all
to anon, authenticated
using (
  sync_space_id = coalesce(nullif(current_setting('request.headers', true)::jsonb ->> 'x-trueview-sync-space-id', ''), 'default')
)
with check (
  sync_space_id = coalesce(nullif(current_setting('request.headers', true)::jsonb ->> 'x-trueview-sync-space-id', ''), 'default')
);

-- Optional storage bucket for a future larger-photo sync upgrade:
insert into storage.buckets (id, name, public)
values ('trueview-photos', 'trueview-photos', false)
on conflict (id) do nothing;

-- Recommended next hardening step:
-- Add Supabase Auth and replace the sync-space policies above with user-owned
-- policies using auth.uid(). The current policy is intended for a single-owner
-- field app using a long unguessable sync space id.
