-- Radi Energy Solutions Digital Twin — editable reference data
-- Run this once in the Supabase SQL editor for a fresh project (see SETUP.md).

create extension if not exists pgcrypto;

-- ============ ZONES + MACHINES (Machine Census) ============
create table if not exists zones (
  id text primary key,
  name text not null,
  wbs_code text not null,
  description text default '',
  color text not null default '#3B82F6',
  line_type text,
  shift_crew_direct integer default 0,
  updated_at timestamptz not null default now()
);

create table if not exists machines (
  id text primary key default gen_random_uuid()::text,
  zone_id text not null references zones(id) on delete cascade,
  wbs_code text not null,
  name text not null,
  description text default '',
  cycle_time_sec numeric not null default 0,
  machines_count integer not null default 1,
  unit_rate_usd numeric not null default 0,
  status text not null default 'running' check (status in ('running','bottleneck','idle','maintenance')),
  utilization_pct numeric default 90,
  updated_at timestamptz not null default now()
);
create index if not exists machines_zone_id_idx on machines(zone_id);

-- ============ WAREHOUSES ============
create table if not exists warehouses (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  area_sqm integer not null default 0,
  type text not null,
  capacity_units integer not null default 0,
  current_stock_pct integer not null default 0,
  description text default '',
  racking_cost_usd integer not null default 0,
  mhe_assigned text[] default '{}',
  safety_rating text default '',
  days_of_buffer numeric,
  daily_production_target integer,
  updated_at timestamptz not null default now()
);

-- ============ WORKFORCE ============
create table if not exists workforce (
  id text primary key default gen_random_uuid()::text,
  ref text not null,
  zone_or_function text not null,
  basis text default '',
  machine_units integer default 0,
  attended_units integer default 0,
  shift_crew integer not null default 0,
  classification text not null default 'Direct' check (classification in ('Direct','Indirect')),
  monthly_salary_usd numeric not null default 0,
  annual_payroll_usd numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- ============ TARIFF PERIODS ============
create table if not exists tariff_periods (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  start_hour integer not null check (start_hour >= 0 and start_hour <= 23),
  end_hour integer not null check (end_hour >= 1 and end_hour <= 24),
  rate_ugx numeric not null default 0,
  rate_usd numeric not null default 0,
  recommended_task text default '',
  updated_at timestamptz not null default now()
);

-- ============ CAPEX ITEMS ============
create table if not exists capex_items (
  id text primary key default gen_random_uuid()::text,
  code text not null,
  category text not null,
  cost_usd numeric not null default 0,
  color text not null default '#3B82F6',
  updated_at timestamptz not null default now()
);

-- ============ updated_at auto-touch ============
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['zones','machines','warehouses','workforce','tariff_periods','capex_items'] loop
    execute format('drop trigger if exists trg_set_updated_at on %I', t);
    execute format('create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ============ Realtime ============
-- Makes row-level INSERT/UPDATE/DELETE events broadcast to subscribed clients.
-- Guarded per-table: a bare `alter publication ... add table` errors with
-- "relation is already member of publication" on a second run, which made this
-- the one statement in an otherwise idempotent file that broke re-runs.
do $$
declare t text;
begin
  foreach t in array array['zones','machines','warehouses','workforce','tariff_periods','capex_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============ Row Level Security ============
-- NOTE: this app has no login/auth system today, so these policies allow
-- anyone with the public anon key (i.e. anyone who loads the site) to read
-- and write. That's the deliberate trade-off for "anyone can collaborate
-- without signing in." If you add auth later, tighten these to
-- `using (auth.uid() is not null)` and drop the public write policies.
alter table zones enable row level security;
alter table machines enable row level security;
alter table warehouses enable row level security;
alter table workforce enable row level security;
alter table tariff_periods enable row level security;
alter table capex_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['zones','machines','warehouses','workforce','tariff_periods','capex_items'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('drop policy if exists "public insert" on %I', t);
    execute format('create policy "public insert" on %I for insert with check (true)', t);
    execute format('drop policy if exists "public update" on %I', t);
    execute format('create policy "public update" on %I for update using (true)', t);
    execute format('drop policy if exists "public delete" on %I', t);
    execute format('create policy "public delete" on %I for delete using (true)', t);
  end loop;
end $$;
