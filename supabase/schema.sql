-- ============================================================================
-- VistorIA — Supabase schema
-- ============================================================================
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste this whole file → Run).
--
-- What this sets up:
--   1. An `inspections` table — one row per vistoria, storing the full
--      inspection as JSONB (same shape the app already uses locally).
--   2. Row Level Security (RLS) so each device/user only ever sees its own
--      vistorias — this is the actual security boundary, not the anon key.
--   3. A Storage bucket for photos/videos/attachments, for when you migrate
--      away from embedding them as base64 inside the JSON (recommended for
--      scale — see the note at the bottom of this file).
--
-- Auth model used here: Supabase Anonymous Auth. The app signs each device in
-- anonymously (no email/password/login screen needed) so every device gets a
-- stable `auth.uid()`, and RLS uses that to keep each device's data private.
-- If you later add real login (email, Google, etc.), existing anonymous users
-- can be upgraded in place — see Supabase docs on "Linking an anonymous user".
-- ============================================================================

-- 1) Table -------------------------------------------------------------------
create table if not exists public.inspections (
  id          text primary key,              -- matches the app's own generated id
  owner_id    uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null,                 -- the full inspection object
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists inspections_owner_id_idx on public.inspections(owner_id);
create index if not exists inspections_updated_at_idx on public.inspections(updated_at desc);

-- Keep updated_at current on every write.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_inspections_updated_at on public.inspections;
create trigger trg_inspections_updated_at
  before update on public.inspections
  for each row execute function public.set_updated_at();

-- 2) Row Level Security -------------------------------------------------------
alter table public.inspections enable row level security;

drop policy if exists "Users can view own inspections" on public.inspections;
create policy "Users can view own inspections"
  on public.inspections for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can insert own inspections" on public.inspections;
create policy "Users can insert own inspections"
  on public.inspections for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update own inspections" on public.inspections;
create policy "Users can update own inspections"
  on public.inspections for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own inspections" on public.inspections;
create policy "Users can delete own inspections"
  on public.inspections for delete
  using (auth.uid() = owner_id);

-- 3) Storage bucket for media (recommended next step, not required to start) -
insert into storage.buckets (id, name, public)
values ('vistoria-media', 'vistoria-media', false)
on conflict (id) do nothing;

drop policy if exists "Users manage own media" on storage.objects;
create policy "Users manage own media"
  on storage.objects for all
  using (bucket_id = 'vistoria-media' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'vistoria-media' and auth.uid()::text = (storage.foldername(name))[1]);

-- Expected object path convention if/when you adopt this bucket:
--   {auth.uid()}/{inspection_id}/{photo_id}.jpg
-- The policy above uses the first path segment as the owner check.

-- ============================================================================
-- NOTE on scaling past the JSONB/base64 approach
-- ============================================================================
-- Right now every photo/video/attachment is embedded as a base64 string
-- inside `data` (jsonb). That's simple and works, but it means:
--   - Each row can get large (Postgres handles it, but it's not ideal)
--   - You re-download all photos every time you fetch the inspection
--
-- The better long-term setup: upload each photo/video to the
-- `vistoria-media` bucket above, store just the Storage path (or a signed
-- URL) in the JSON instead of the base64 string, and fetch media lazily.
-- This is a real code change in src/lib/sync.js — ask an AI assistant
-- (Claude, etc.) with a prompt like:
--
--   "In this Vite + React + Supabase project, change src/lib/sync.js so
--   that when pushing an inspection to Supabase, every photo/video/anexo
--   with a base64 data URL gets uploaded to the 'vistoria-media' Storage
--   bucket under path {ownerId}/{inspectionId}/{randomId}.{ext} instead,
--   and the inspection JSON stores the Storage path instead of the base64
--   string. When pulling an inspection back down, generate signed URLs
--   (supabase.storage.from('vistoria-media').createSignedUrl(...)) for each
--   stored path before handing the inspection back to the React app."
-- ============================================================================
