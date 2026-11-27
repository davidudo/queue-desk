import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { setTimeout, clearTimeout, setInterval, clearInterval } from 'node:timers';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, URL, URLSearchParams } from 'node:url';
const { fetch } = globalThis;
import dotenv from 'dotenv';
import pg from 'pg';

// Local, disposable databases only. Keep the original seed database for replay.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
dotenv.config();
const arg = (name) =>
  process.argv
    .find((s) => s.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve(arg('output') || `benchmarks/results/baseline-${stamp}`);
await fs.mkdir(output, { recursive: true });
const configured = new URL(process.env.DATABASE_URL);
assert(
  ['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname),
  'Only local PostgreSQL is supported',
);
const dbUrl = (name) => {
  const url = new URL(configured);
  url.pathname = `/${name}`;
  return url.href;
};
const admin = new pg.Client({ connectionString: dbUrl('postgres') });
await admin.connect();
const prepared = arg('prepared-template');
const template = prepared || `queuedesk_baseline_seed_${Date.now()}`;
assert(/^queuedesk_baseline_seed_\d+$/.test(template), 'Invalid template name');
const working = template.replace('_seed_', '_work_');
const port = 4100;
const baseUrl = `http://127.0.0.1:${port}`;
const query = 'page=1&pageSize=25&status=open&priority=high&sortBy=updated_at&sortOrder=desc';
const settings = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'warn',
  API_PORT: String(port),
  API_HOST: '127.0.0.1',
  RATE_LIMIT_MAX_REQUESTS: '10000000',
  AUTH_RATE_LIMIT_MAX_REQUESTS: '1000',
  PG_POOL_MAX: '20',
  PG_IDLE_TIMEOUT_MS: '30000',
  PG_CONNECTION_TIMEOUT_MS: '5000',
  PG_STATEMENT_TIMEOUT_MS: '15000',
  API_REQUEST_TIMEOUT_MS: '15000',
};
const env = { ...process.env, ...settings, DATABASE_URL: dbUrl(working) };
const writeJson = (name, value) =>
  fs.writeFile(path.join(output, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
const command = (name, args) => execFileSync(name, args, { encoding: 'utf8' }).trim();
async function run(label, executable, args, extraEnv = env) {
  console.log(`${new Date().toISOString()} ${label}`);
  const log = await fs.open(path.join(output, `${label}.txt`), 'w');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(executable, args, { env: extraEnv, stdio: ['ignore', log.fd, log.fd] });
      child.on('error', reject);
      child.on('exit', (code, signal) =>
        code === 0 ? resolve() : reject(new Error(`${label} failed (${code ?? signal}); see log`)),
      );
    });
  } finally {
    await log.close();
  }
}
let server;
let serverLog;
async function stop() {
  if (!server) return;
  const child = server;
  server = undefined;
  if (child.exitCode === null) {
    await new Promise((resolve) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 12000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }
  await serverLog?.close();
}
async function clone() {
  await stop();
  await admin.query(`DROP DATABASE IF EXISTS "${working}"`);
  await admin.query(`CREATE DATABASE "${working}" TEMPLATE "${template}"`);
}
async function start(label) {
  serverLog = await fs.open(path.join(output, `${label}-api.txt`), 'w');
  server = spawn(process.execPath, ['apps/api/dist/server.js'], {
    env,
    stdio: ['ignore', serverLog.fd, serverLog.fd],
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Benchmark API failed to start');
    try {
      const res = await fetch(`${baseUrl}/ready`);
      if (res.ok) return;
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('API readiness timeout');
}
async function benchmark(label, mode, connections, duration) {
  const samples = [];
  const timer = setInterval(() => {
    try {
      samples.push({
        at: new Date().toISOString(),
        cpuAndRss: command('ps', ['-p', String(server.pid), '-o', '%cpu=,rss=']),
      });
    } catch {
      /* process exited */
    }
  }, 5000);
  try {
    await run(label, 'pnpm', [
      'exec',
      'tsx',
      'benchmarks/run-autocannon.ts',
      `--url=${baseUrl}`,
      `--connections=${connections}`,
      `--duration=${duration}`,
      `--mode=${mode}`,
      `--query=${query}`,
      '--write-targets=100',
      `--output=${path.join(output, `${label}.json`)}`,
    ]);
  } finally {
    clearInterval(timer);
    await writeJson(`${label}-api-process`, samples);
  }
}
try {
  if (!prepared) {
    await run('build-shared', 'pnpm', ['--filter', '@queuedesk/shared', 'build']);
    await run('build-api', 'pnpm', ['--filter', '@queuedesk/api', 'build']);
    await admin.query(`CREATE DATABASE "${template}"`);
    const seedEnv = {
      ...env,
      DATABASE_URL: dbUrl(template),
      SEED_PROFILE: 'large',
      SEED_RANDOM: '42',
    };
    await run('migrate', 'pnpm', ['run', 'db:migrate'], seedEnv);
    await run('seed', 'pnpm', ['run', 'db:seed'], seedEnv);
  }
  const db = new pg.Client({ connectionString: dbUrl(template) });
  await db.connect();
  try {
    await db.query('ANALYZE');
    const tables = [
      'tickets',
      'comments',
      'ticket_activity',
      'ticket_tags',
      'audit_logs',
      'users',
      'agents',
      'queues',
      'tags',
    ];
    const counts = {};
    for (const table of tables)
      counts[table] = (await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
    assert.equal(counts.tickets, 250000);
    const environment = {
      capturedAt: new Date().toISOString(),
      commit: command('git', ['rev-parse', 'HEAD']),
      node: process.version,
      pnpm: command('pnpm', ['--version']),
      macOS: command('sw_vers', []),
      cpu: os.cpus()[0].model,
      logicalCpuCount: os.cpus().length,
      memoryBytes: os.totalmem(),
      postgres: (await db.query('SELECT version()')).rows[0].version,
      postgresSettings: (
        await db.query(
          'SELECT name, setting, unit FROM pg_settings WHERE name = ANY($1) ORDER BY name',
          [
            [
              'shared_buffers',
              'effective_cache_size',
              'work_mem',
              'max_connections',
              'max_parallel_workers_per_gather',
              'random_page_cost',
              'jit',
            ],
          ],
        )
      ).rows,
      templateDatabase: template,
      workingDatabase: working,
      counts,
      apiSettings: settings,
      read: { query, connections: 20, durationSeconds: 30, warmupSeconds: 15, repeats: 3 },
      write: { targets: 100, connections: 5, durationSeconds: 30, warmupSeconds: 15, repeats: 3 },
      seed: { profile: 'large', seed: 42 },
      sourceHashes: {},
    };
    for (const name of [
      'pnpm-lock.yaml',
      'benchmarks/run-autocannon.ts',
      'benchmarks/run-baseline.mjs',
      'apps/api/src/repositories/ticket.repository.ts',
    ]) {
      environment.sourceHashes[name] = crypto
        .createHash('sha256')
        .update(await fs.readFile(name))
        .digest('hex');
    }
    await writeJson('environment', environment);
    await writeJson(
      'queue-distribution',
      (
        await db.query(
          'SELECT q.name, count(t.id)::int AS tickets FROM queues q LEFT JOIN tickets t ON t.queue_id=q.id GROUP BY q.id ORDER BY tickets DESC',
        )
      ).rows,
    );
    await writeJson(
      'indexes',
      (
        await db.query(
          "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
        )
      ).rows,
    );
  } finally {
    await db.end();
  }
  await run(
    'snapshot',
    'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl', '--file', path.join(output, 'seed.dump')],
    {
      ...env,
      PGDATABASE: template,
      PGHOST: configured.hostname,
      PGPORT: configured.port || '5432',
      PGUSER: decodeURIComponent(configured.username) || os.userInfo().username,
      ...(configured.password ? { PGPASSWORD: decodeURIComponent(configured.password) } : {}),
    },
  );
  await fs.writeFile(
    path.join(output, 'snapshot.sha256'),
    crypto
      .createHash('sha256')
      .update(await fs.readFile(path.join(output, 'seed.dump')))
      .digest('hex') + '  seed.dump\n',
  );
  await clone();
  await start('reads');
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.BENCH_EMAIL || 'agent1@queuedesk.local',
      password: process.env.BENCH_PASSWORD || 'QueueDesk!Agent2026',
    }),
  });
  assert.equal(login.status, 200);
  const token = (await login.json()).data.token;
  const dbRead = new pg.Client({ connectionString: dbUrl(working) });
  await dbRead.connect();
  try {
    const expectedCount = (
      await dbRead.query(
        "SELECT count(*)::int AS n FROM tickets WHERE status='open' AND priority='high'",
      )
    ).rows[0].n;
    const correctness = [];
    for (const page of [1, 2, 100000]) {
      const params = new URLSearchParams(query);
      params.set('page', String(page));
      const res = await fetch(`${baseUrl}/api/v1/tickets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      const expected = (
        await dbRead.query(
          "SELECT id FROM tickets WHERE status='open' AND priority='high' ORDER BY updated_at DESC,id ASC LIMIT 25 OFFSET $1",
          [(page - 1) * 25],
        )
      ).rows.map((r) => r.id);
      assert.deepEqual(
        body.data.map((t) => t.id),
        expected,
      );
      assert.equal(body.meta.totalCount, expectedCount);
      assert(
        body.data.every(
          (t) => t.status === 'open' && t.priority === 'high' && Array.isArray(t.tags),
        ),
      );
      correctness.push({
        page,
        expectedCount,
        expectedIds: expected,
        response: body,
        payloadBytes: Buffer.byteLength(JSON.stringify(body)),
      });
    }
    await writeJson('correctness', {
      passed: true,
      checked: 'SQL IDs/order, exact total, filters, tags, empty deep page',
      pages: correctness,
    });
    // Capture the SQL the real repository executes, including the tag lookup.
    process.env.DATABASE_URL = dbUrl(working);
    process.env.LOG_LEVEL = 'warn';
    const { pool } = await import('../apps/api/dist/config/database.js');
    const { ticketRepository } = await import('../apps/api/dist/repositories/ticket.repository.js');
    const captured = [];
    const originalQuery = pool.query.bind(pool);
    pool.query = async (sql, params) => {
      captured.push({ sql, params });
      return originalQuery(sql, params);
    };
    try {
      await ticketRepository.listTickets({
        page: 1,
        pageSize: 25,
        status: 'open',
        priority: 'high',
        sortBy: 'updated_at',
        sortOrder: 'desc',
      });
      const plans = [];
      for (const q of captured) {
        const plan = (
          await dbRead.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${q.sql}`, q.params)
        ).rows[0]['QUERY PLAN'];
        plans.push({ ...q, plan });
      }
      await writeJson('actual-query-plans', plans);
    } finally {
      pool.query = originalQuery;
      await pool.end();
    }
  } finally {
    await dbRead.end();
  }
  await run('diagnostic-explain', 'pnpm', ['run', 'benchmark:explain']);
  await benchmark('read-warmup', 'read', 20, 15);
  for (let i = 1; i <= 3; i++) await benchmark(`read-${i}`, 'read', 20, 30);
  // Discard the write warmup database. Every measured run gets the same rows.
  await clone();
  await start('write-warmup');
  await benchmark('write-warmup', 'write', 5, 15);
  for (let i = 1; i <= 3; i++) {
    await clone();
    await start(`write-${i}`);
    // Warm read-only detail paths without changing write fixtures.
    await fetch(`${baseUrl}/ready`);
    await benchmark(`write-${i}`, 'write', 5, 30);
  }
  const summaries = [];
  for (const mode of ['read', 'write'])
    for (let i = 1; i <= 3; i++)
      summaries.push({
        run: `${mode}-${i}`,
        ...JSON.parse(await fs.readFile(path.join(output, `${mode}-${i}.json`), 'utf8')),
      });
  await writeJson('summary', summaries);
  console.log('Baseline complete:', output);
} finally {
  await stop();
  await admin.end();
}
