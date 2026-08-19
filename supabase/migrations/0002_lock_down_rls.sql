-- OPTIONAL — do not run this yet.
--
-- 0001_init.sql leaves every table world-writable: anyone who loads the site
-- gets the public anon key, and the policies are `using (true)`. That was the
-- deliberate trade-off for "collaborate without signing in", and it is fine
-- while the URL is private. It stops being fine the moment the Vercel
-- deployment is shared, because a stranger can delete your machine census.
--
-- Run this AFTER you have added Supabase Auth to the app (email magic link is
-- enough). It keeps reads public — so an unauthenticated visitor still sees the
-- twin — and requires a signed-in session for every write.
--
-- To go back, re-run the corresponding block at the bottom of 0001_init.sql.
--
-- Safe to re-run.

do $$
declare t text;
begin
  foreach t in array array['zones','machines','warehouses','workforce','tariff_periods','capex_items'] loop

    -- Reads stay open: the digital twin is meant to be viewable.
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);

    -- Writes now require an authenticated session.
    execute format('drop policy if exists "public insert" on %I', t);
    execute format('drop policy if exists "public update" on %I', t);
    execute format('drop policy if exists "public delete" on %I', t);

    execute format('drop policy if exists "authenticated insert" on %I', t);
    execute format(
      'create policy "authenticated insert" on %I for insert to authenticated with check (auth.uid() is not null)', t);

    execute format('drop policy if exists "authenticated update" on %I', t);
    execute format(
      'create policy "authenticated update" on %I for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)', t);

    execute format('drop policy if exists "authenticated delete" on %I', t);
    execute format(
      'create policy "authenticated delete" on %I for delete to authenticated using (auth.uid() is not null)', t);

  end loop;
end $$;

-- Sanity check — every table should list one public read policy and three
-- authenticated write policies after this runs.
--
--   select tablename, policyname, roles, cmd
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename, cmd;
