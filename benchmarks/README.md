# Performance baseline

Run a complete local baseline with:

```sh
node benchmarks/run-baseline.mjs
```

The command builds the shared package and API, creates an isolated PostgreSQL
seed database, migrates it, seeds 250,000 tickets with random seed 42, runs
`ANALYZE`, saves a custom-format `pg_dump`, and launches a compiled API on
`127.0.0.1:4100`. The configured `DATABASE_URL` must point to local PostgreSQL;
its host and credentials are reused, but its database is never modified.
The PostgreSQL account needs permission to create databases. Port 4100 must be
available. Existing development services are not stopped.

It then checks the list API against direct SQL, captures the actual repository
query plans, warms the read workload for 15 seconds, and collects three 30-second
read runs at 20 connections. Reads use:

```text
page=1&pageSize=25&status=open&priority=high&sortBy=updated_at&sortOrder=desc
```

Write load uses five connections and 100 tickets, with disjoint ticket sets per
connection. Requests alternate priority between high and medium so changes are
not repeatedly no-ops. A separate 15-second write warmup is discarded. Each
30-second measured write run starts from a fresh database clone of the seed,
with a fresh API process; startup effects and increasing activity history during
the measured run are part of this workload. Read and write workloads run
separately; this is not a mixed-load benchmark.

The API is stopped when the runner finishes. The seed database, last working
clone, and artifacts remain available for inspection. Timestamped artifacts are
under `benchmarks/results/` and ignored by Git, including the database snapshot.
They include environment information, file hashes, JSON metrics, response
fixtures, correctness checks, query plans, and process samples. Tokens and
passwords are not written into the metrics files. Review any environment or
process records before sharing outside your machine.

To repeat with exactly the same seed rows and timestamps, reuse the saved seed
database rather than reseeding. Substitute the name in `environment.json`:

```sh
node benchmarks/run-baseline.mjs \
  --prepared-template=queuedesk_baseline_seed_REPLACE_WITH_TIMESTAMP
```

Build the API first when testing a changed implementation. `--prepared-template`
skips building and seeding. The working clone is recreated, so do not modify its
schema to test a candidate: apply candidate migrations to a separate clone or
extend the runner to apply them after each clone. Keep the seed template intact.

The retained `seed.dump` also supports restoration to a new disposable database
with `createdb` and `pg_restore --no-owner --no-acl --dbname=NAME seed.dump`.
Do not restore over development or production data.

## Metrics and interpretation

The Autocannon wrapper accepts `--output=PATH` for JSON output and
`--write-targets=100` for distributed writes. It calculates true p50, p95, and
p99 using nearest rank over successful response durations; it does not label
Autocannon's p97.5 as p95. Failed responses, transport errors, or timeouts make a
run invalid and produce a nonzero exit status. Warmups are excluded from summary
statistics. The summary latency excludes unfinished requests at the cutoff;
error and timeout counters must always be checked alongside latency.

This is a fixed-concurrency, closed-loop workload with no think time. Connections
are not equivalent to a count of human agents. The generator, API, PostgreSQL,
and other desktop applications share the Mac, so results describe this local
configuration rather than production capacity. The wrapper records generator
CPU time; process samples record API CPU and RSS. Neither measures total system
saturation or establishes an unrestricted server throughput ceiling.

`run-explain.ts` retains its simplified diagnostic examples. The automated runner
also captures and explains the real count, joined list, and tag lookup SQL from
`ticketRepository.listTickets`. Query plans are collected before load and their
timings must not be added to predict concurrent HTTP latency.
