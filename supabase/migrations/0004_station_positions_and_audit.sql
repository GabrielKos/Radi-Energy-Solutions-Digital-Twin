-- Radi Energy Solutions Digital Twin
-- 0004 — shared Floor Twin station positions, and an append-only change trail.
--
-- Run this in the Supabase SQL editor after 0001/0003. Safe to re-run.
--
-- Two things arrive here:
--
--   station_positions — where each Floor Twin station sits on the plant floor.
--     Dragging a station used to move it in one browser's memory only: the move
--     was lost on refresh and no colleague ever saw it. Positions now live here,
--     so the whole team works from one agreed layout.
--
--   audit_log — who changed what, when. Append-only by policy: the app can
--     insert and read, but there is no update or delete policy, so a trail
--     entry cannot be altered or erased through the public anon key.

create extension if not exists pgcrypto;

-- ============ STATION POSITIONS ============
-- `id` is the canvas node id ('W01', 'S_BOT_1', 'CY_14', …), which is generated
-- deterministically by buildFactoryModel, so a row keeps matching its station
-- across rebuilds. Rows for stations that no longer exist are simply ignored on
-- load, which is what makes changing the machine census safe: the layout drops
-- stale positions instead of breaking.
create table if not exists station_positions (
  id text primary key,
  x numeric not null,
  y numeric not null,
  updated_by text default '',
  updated_at timestamptz not null default now()
);

-- ============ AUDIT LOG ============
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  -- Self-declared in the authorisation dialog. It identifies the person for a
  -- colleague reading the trail; it is not a verified sign-in. Verified identity
  -- needs Supabase Auth — see 0002_lock_down_rls.sql.
  actor_email text not null default '',
  action text not null check (action in ('create', 'update', 'delete')),
  -- Which table was written, e.g. 'machines', 'station_positions'.
  entity text not null,
  -- Primary key of the affected row.
  record_id text not null default '',
  -- Human-readable name at the time of the change, so the trail still reads
  -- sensibly after the record itself is renamed or deleted.
  record_label text not null default '',
  -- { field: { from: <old>, to: <new> } }. Empty object for a delete.
  changes jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_at_idx on audit_log (at desc);
create index if not exists audit_log_entity_idx on audit_log (entity, record_id);
create index if not exists audit_log_actor_idx on audit_log (actor_email);

-- ============ updated_at auto-touch ============
-- set_updated_at() is created in 0001; re-created here so this file can be run
-- against a project where only 0001's tables exist.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_updated_at on station_positions;
create trigger trg_set_updated_at
  before update on station_positions
  for each row execute function set_updated_at();

-- ============ Realtime ============
-- Guarded per table: a bare `alter publication … add table` errors with
-- "relation is already member of publication" on a second run.
do $$
declare t text;
begin
  foreach t in array array['station_positions','audit_log'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============ Row Level Security ============
alter table station_positions enable row level security;
alter table audit_log enable row level security;

-- Station positions follow the same open policy as the rest of the app's
-- tables (see the note in 0001_init.sql). The engineering password challenge in
-- the app is what gates a move in practice; 0002_lock_down_rls.sql is what will
-- gate it properly once Supabase Auth is added.
drop policy if exists "public read" on station_positions;
create policy "public read" on station_positions for select using (true);
drop policy if exists "public insert" on station_positions;
create policy "public insert" on station_positions for insert with check (true);
drop policy if exists "public update" on station_positions;
create policy "public update" on station_positions for update using (true);
drop policy if exists "public delete" on station_positions;
create policy "public delete" on station_positions for delete using (true);

-- The trail is deliberately append-only: readable and insertable, with no
-- update or delete policy at all. Postgres denies anything a policy does not
-- explicitly permit, so an entry cannot be rewritten or removed by a client —
-- which is the whole point of keeping a trail.
drop policy if exists "public read" on audit_log;
create policy "public read" on audit_log for select using (true);
drop policy if exists "public insert" on audit_log;
create policy "public insert" on audit_log for insert with check (true);
drop policy if exists "public update" on audit_log;
drop policy if exists "public delete" on audit_log;

-- Sanity check — station_positions should list four policies, audit_log two:
--
--   select tablename, policyname, cmd
--   from pg_policies
--   where schemaname = 'public' and tablename in ('station_positions','audit_log')
--   order by tablename, cmd;
