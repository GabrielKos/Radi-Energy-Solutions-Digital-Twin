-- Batch stations need a batch size.
--
-- The machine census stores a cycle time and a unit count, which is enough for
-- an in-line station but not for batch equipment. The three adhesive curing
-- tunnels each hold 50 packs for a 3,600 s cure: without a batch size their
-- effective takt reads as 3600 / 3 = 1,200 s, which makes them look like a
-- catastrophic line bottleneck instead of their true ~24 s contribution.
--
-- Effective station takt is now: cycle_time_sec / (machines_count * packs_per_cycle)
--
-- Safe to re-run.

alter table machines
  add column if not exists packs_per_cycle integer not null default 1
  check (packs_per_cycle >= 1);

-- The one genuinely batched station in the shipped data.
update machines set packs_per_cycle = 50 where id = 'C.1.5.7' and packs_per_cycle = 1;
