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

-- ---------------------------------------------------------------------------
-- P21: live fixture cache (football-data.org automation)
--
-- This is deliberately a separate table from matchday_workspaces above: it's
-- a shared, public read-only cache of real fixture data, written only by the
-- scheduled cron job (via the service-role key, which bypasses RLS entirely).
-- It has no owner_user_id and no relationship to any individual's saved
-- workspace — every signed-in or anonymous visitor sees the same rows.
-- ---------------------------------------------------------------------------

create table if not exists public.live_fixtures (
  id text primary key,               -- football-data.org match id, as text
  competition text not null,
  round text,
  match_date timestamptz not null,
  home_team text not null,
  away_team text not null,
  home_stats jsonb not null,         -- shape: TeamStats
  away_stats jsonb not null,         -- shape: TeamStats
  home_recent_form jsonb not null,   -- shape: RecentFormGame[]
  away_recent_form jsonb not null,   -- shape: RecentFormGame[]
  status text not null default 'SCHEDULED',
  updated_at timestamptz not null default now()
);

-- `competition` above is football-data.org's human-readable display name
-- (e.g. "FIFA World Cup"), which varies by competition and isn't reliable to
-- filter on. `competition_code` is the short code the app actually requests
-- data with (e.g. "WC", "PL") and is what the UI's competition dropdowns
-- filter by. Added after the initial table; safe to run again on an
-- existing table.
alter table public.live_fixtures add column if not exists competition_code text;
create index if not exists live_fixtures_competition_code_idx on public.live_fixtures (competition_code);

create index if not exists live_fixtures_match_date_idx on public.live_fixtures (match_date);
create index if not exists live_fixtures_competition_idx on public.live_fixtures (competition);

alter table public.live_fixtures enable row level security;

drop policy if exists "live_fixtures_public_read" on public.live_fixtures;
create policy "live_fixtures_public_read"
  on public.live_fixtures
  for select
  using (true);

-- No insert/update/delete policy is defined on purpose: the cron job writes
-- using the Supabase service-role key, which bypasses RLS. No anon/authenticated
-- client can write to this table under any circumstances.

-- P22 note: old live fixture rows are now cleaned by the scheduled cron route
-- after each successful refresh, and can also be deleted manually from the
-- app's Live Fixture Maintenance panel via the admin route. This keeps the
-- public live_fixtures cache from growing indefinitely while preserving the
-- user-owned matchday_workspaces table unchanged.

-- ---------------------------------------------------------------------------
-- Explicit Data API grants.
--
-- Supabase changed its default: as of May 30 2026, new projects no longer
-- auto-expose newly created public-schema tables to the REST/GraphQL Data
-- API — a Postgres GRANT is required in addition to RLS. RLS alone controls
-- which *rows* a role sees; GRANT controls whether a role can reach the
-- table via the API at all. Running these is harmless on older projects
-- that still use the previous auto-expose default.
-- ---------------------------------------------------------------------------

grant select on public.live_fixtures to anon, authenticated;
grant select, insert, update, delete on public.matchday_workspaces to authenticated;
