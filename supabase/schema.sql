-- MatchDay / Tipping Gates App P13 cloud persistence schema
-- Run this in the Supabase SQL editor.
-- P13 uses Supabase Auth so each cloud workspace is owned by the signed-in user.

create table if not exists public.matchday_workspaces (
  workspace_id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Upgrade path for earlier P12 table if it already exists.
alter table public.matchday_workspaces
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

-- If you used P12 public workspaces, decide whether to migrate or delete those rows before
-- making owner_user_id NOT NULL. For new P13 installs, the table above creates it as NOT NULL.
-- Safe hardening command after old rows are resolved:
-- alter table public.matchday_workspaces alter column owner_user_id set not null;

alter table public.matchday_workspaces enable row level security;

drop policy if exists "matchday_workspaces_select" on public.matchday_workspaces;
drop policy if exists "matchday_workspaces_insert" on public.matchday_workspaces;
drop policy if exists "matchday_workspaces_update" on public.matchday_workspaces;
drop policy if exists "Users can read own matchday workspaces" on public.matchday_workspaces;
drop policy if exists "Users can insert own matchday workspaces" on public.matchday_workspaces;
drop policy if exists "Users can update own matchday workspaces" on public.matchday_workspaces;
drop policy if exists "Users can delete own matchday workspaces" on public.matchday_workspaces;

create policy "Users can read own matchday workspaces"
  on public.matchday_workspaces
  for select
  using (auth.uid() = owner_user_id);

create policy "Users can insert own matchday workspaces"
  on public.matchday_workspaces
  for insert
  with check (auth.uid() = owner_user_id);

create policy "Users can update own matchday workspaces"
  on public.matchday_workspaces
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create policy "Users can delete own matchday workspaces"
  on public.matchday_workspaces
  for delete
  using (auth.uid() = owner_user_id);

create index if not exists matchday_workspaces_owner_user_id_idx
  on public.matchday_workspaces(owner_user_id);
