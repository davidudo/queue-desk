# QueueDesk local baseline — 27 November 2026

The unoptimized ticket API was measured on this Mac. No application queries or
indexes were changed. Development and test databases were not seeded or reset;
all benchmark traffic used separate local PostgreSQL databases.

## Results

Each measured run lasted 30 seconds; warmups are excluded. Latency is in
milliseconds and uses nearest rank over successful response durations.

| Run     | Connections | p50 ms | p95 ms | p99 ms | Requests/sec | Successful responses | Errors/non-2xx/timeouts |
| ------- | ----------: | -----: | -----: | -----: | -----------: | -------------------: | ----------------------: |
| read-1  |          20 | 526.43 | 740.36 | 881.15 |        38.10 |                1,143 |                       0 |
| read-2  |          20 | 506.68 | 733.57 | 963.36 |        39.50 |                1,185 |                       0 |
| read-3  |          20 | 507.79 | 734.43 | 841.62 |        39.60 |                1,188 |                       0 |
| write-1 |           5 |   4.86 |  10.95 |  13.99 |       888.67 |               26,660 |                       0 |
| write-2 |           5 |   4.87 |  10.50 |  13.17 |       905.64 |               27,169 |                       0 |
| write-3 |           5 |   4.87 |  10.86 |  13.52 |       898.44 |               26,953 |                       0 |

Median read p95: **734.43 ms**.
Median write p95: **10.86 ms**.
Median read throughput: **39.50 requests/sec**.
Median write throughput: **898.44 requests/sec**.
All six measured runs passed the zero-error check. These are baseline
observations, not a pass against a latency target; that target is not yet set.

## Environment and dataset

- Application commit: `42cefe41d62c10a98fc2468443a780dfd8cbe451`.
- Hardware: Apple M1 Pro, 8 logical CPUs, 16 GiB memory; AC power observed.
- macOS: 27.2.1; Node: v26.13.1; pnpm: 9.15.9.
- PostgreSQL: 16.16, local Homebrew installation.
- Compiled Express API in production mode on `127.0.0.1:4100`.
- Pool maximum: 20; connection timeout: 5 seconds; statement timeout: 15 seconds.
- Request limit raised to 10,000,000 per window for local load; auth limit 1,000.
- Logging: warn. Full environment whitelist and PostgreSQL settings are saved.
- Seed profile: large; random seed: 42; statistics collected with `ANALYZE`.
- 250,000 tickets; 113,542 comments;
  112,264 initial activity rows;
  233,315 ticket/tag relationships; 38 staff profiles.
- Seed database: `queuedesk_baseline_seed_1795793221412`.
- Last working clone: `queuedesk_baseline_work_1795793221412`.

The original seed database and a checksummed custom-format database dump are
retained, preserving UUIDs and timestamps as well as the distribution. Reusing a
random seed alone would not preserve those values.

## Workloads

**Reads:** authenticated GET to `/api/v1/tickets`, 20 persistent connections,
pipelining 1, no think time. Fixed parameters:

`page=1&pageSize=25&status=open&priority=high&sortBy=updated_at&sortOrder=desc`

A 15-second warmup preceded the three consecutive measured runs. The exact filter
matched **6,642 tickets**. The saved first-page JSON payload is
22,317 bytes when serialized without transport compression.

**Writes:** authenticated PATCH to `/api/v1/tickets/:id`, five connections,
100 tickets selected by ascending ticket number. Each connection owns a disjoint
set of 20 tickets and alternates high/medium priority. The endpoint updates the
row and returns full ticket details, including accumulated activity. Subsequent
updates change priority; the first high update can match the seeded value.
A 15-second write warmup used a disposable clone. Every measured write run used
a fresh clone and API process. Initialization and growing history during each
run remain part of the measured workload. The last run changed all 100 intended
tickets and retained the 250,000-ticket total.

The saved Autocannon JSON `url` is the configured initial list URL; for writes,
per-connection request definitions override it with the PATCH paths above. The
actual target IDs and write pattern are included in each write artifact.

## Correctness and query plans

Before load, API pages 1, 2, and 100000 were checked against direct SQL for exact
IDs, deterministic ordering, and total count. Returned rows also passed the
status/priority and tag-array checks. The deep page returned zero rows with the
correct total. This is a baseline fixture for later comparison, not verification
of a future optimization or every possible filter combination.

Captured SQL came from the real repository, rather than only the simplified
EXPLAIN examples. Single pre-load `EXPLAIN (ANALYZE, BUFFERS)` executions took:

- Exact count: 37.333 ms; parallel sequential scan of tickets.
- Joined, filtered, sorted list: 30.504 ms; parallel sequential scan plus sort and joins.
- Tag lookup for the selected IDs: 0.208 ms; uses the ticket/tag primary-key index.

Both the count and list scan the ticket table. These are candidates to investigate
in the recording. The separate plan timings do not establish which dominates
under concurrent HTTP load and must not be summed to predict endpoint latency.
No competing optimization has been implemented or selected.

## Evidence and replay

The local artifact bundle is [baseline-2026-11-27T15-30-15-231Z](results/baseline-2026-11-27T15-30-15-231Z/). It contains:

- `environment.json`, `queue-distribution.json`, and `indexes.json`.
- `summary.json`, individual JSON metrics, and readable benchmark logs.
- `correctness.json`, `write-validation.json`, and `actual-query-plans.json`.
- `seed.dump` and `snapshot.sha256`.
- Archived runner sources matching the measurement-time hashes, plus API CPU/RSS samples.
- `host-context.txt`, capturing power state, load, and busy processes during reads.

The protocol runner subsequently received explicit Node imports for linting;
its archived measurement-time source remains available. Numeric results were
not recomputed from another run.

For a fresh complete baseline:

`node benchmarks/run-baseline.mjs`

For the same retained seed rows, build the desired API version first, then run:

`node benchmarks/run-baseline.mjs --prepared-template=queuedesk_baseline_seed_1795793221412`

See [the benchmark guide](README.md) for prerequisites, snapshot restoration,
workload semantics, and candidate migration considerations. Snapshot bundles
are ignored by Git. The benchmark API was stopped after completion; both
isolated databases were retained for inspection and replay.

## Limits and next decision

The load generator, API, database, and desktop applications shared the Mac.
Background desktop processes were active. Generator CPU usage was low in the
saved measurements, but this does not prove the database was free of CPU or
I/O contention. These results describe this local setup, not production capacity.

Reads and writes were measured separately, not concurrently. The workload is
closed-loop and connections do not correspond directly to a count of people.
Percentiles exclude requests still unfinished at cutoff, so response counts,
errors, and timeouts must always accompany latency. No response failures or
transport timeouts were reported in measured runs.

Next, choose and document a read latency target and write regression cap with a
business justification. A read p95 below 500 ms at this same 20-connection
workload would be a concrete candidate because all baseline runs miss it.
A 10% write p95 regression cap would imply approximately 11.94 ms against the
median write baseline, but confirm tolerance and measurement variability before
adopting it. These are proposed criteria, not user-approved requirements.
