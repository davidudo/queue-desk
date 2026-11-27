import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import autocannon from 'autocannon';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const match = process.argv.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function authenticate(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.BENCH_EMAIL || 'agent1@queuedesk.local',
      password: process.env.BENCH_PASSWORD || 'QueueDesk!Agent2026',
    }),
  });
  if (!res.ok) {
    throw new Error(`Authentication failed with status ${res.status}`);
  }
  const json = (await res.json()) as { data: { token: string } };
  return json.data.token;
}

async function run() {
  const baseUrl = getArg('url', 'http://localhost:4000');
  const connections = Number(getArg('connections', '20'));
  const duration = Number(getArg('duration', '15'));
  const mode = getArg('mode', 'read');
  const query = getArg('query', 'page=1&pageSize=25&status=open&sortBy=updated_at&sortOrder=desc');

  console.log(`Authenticating against ${baseUrl}...`);
  const token = await authenticate(baseUrl);

  if (!['read', 'write'].includes(mode)) throw new Error('mode must be read or write');
  if (
    !Number.isInteger(connections) ||
    connections < 1 ||
    !Number.isFinite(duration) ||
    duration < 1
  ) {
    throw new Error('connections and duration must be positive');
  }
  const writeTargets = Number(getArg('write-targets', '1'));
  if (!Number.isInteger(writeTargets) || writeTargets < 1 || writeTargets > 100) {
    throw new Error('write-targets must be between 1 and 100');
  }
  const targetUrl = `${baseUrl}/api/v1/tickets?${query}`;
  let targetIds: string[] = [];
  if (mode === 'write') {
    const listRes = await fetch(
      `${baseUrl}/api/v1/tickets?page=1&pageSize=${writeTargets}&sortBy=ticket_number&sortOrder=asc`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!listRes.ok) throw new Error(`Write fixture lookup failed: ${listRes.status}`);
    const listJson = (await listRes.json()) as { data: Array<{ id: string }> };
    targetIds = listJson.data.map((ticket) => ticket.id);
    if (targetIds.length !== writeTargets) throw new Error('Not enough write fixture tickets');
    if (writeTargets > 1 && writeTargets < connections) {
      throw new Error('Use at least one write target per connection');
    }
  }
  const successfulLatencies: number[] = [];
  const statusCounts: Record<string, number> = {};
  let clientIndex = 0;
  const startedAt = new Date().toISOString();
  const cpuStart = process.cpuUsage();
  console.log(
    `Running Autocannon (${mode.toUpperCase()}) -> ${targetUrl} | connections=${connections}, duration=${duration}s`,
  );

  const result = await new Promise<autocannon.Result>((resolve, reject) => {
    const instance = autocannon(
      {
        url: targetUrl,
        connections,
        duration,
        pipelining: 1,
        timeout: 20,
        headers: { Authorization: `Bearer ${token}` },
        ...(mode === 'write'
          ? {
              setupClient: (client: autocannon.Client) => {
                const index = clientIndex++ % connections;
                const ids = targetIds.filter(
                  (_, i) => targetIds.length === 1 || i % connections === index,
                );
                // Disjoint ticket sets per connection; each update changes priority.
                client.setRequests(
                  ids.flatMap((id) =>
                    ['high', 'medium'].map((priority) => ({
                      method: 'PATCH' as const,
                      path: `/api/v1/tickets/${id}`,
                      headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ priority }),
                    })),
                  ),
                );
              },
            }
          : {}),
      },
      (err, value) => (err ? reject(err) : resolve(value)),
    );
    instance.on('response', (_client, statusCode, _bytes, responseTime) => {
      statusCounts[statusCode] = (statusCounts[statusCode] ?? 0) + 1;
      if (statusCode >= 200 && statusCode < 300) successfulLatencies.push(responseTime);
    });
  });
  const generatorCpu = process.cpuUsage(cpuStart);
  successfulLatencies.sort((a, b) => a - b);
  const percentile = (p: number) =>
    successfulLatencies[Math.ceil(successfulLatencies.length * p) - 1] ?? null;
  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    mode,
    url: targetUrl,
    connections,
    durationSeconds: result.duration,
    pipelining: 1,
    writeTargets: targetIds,
    writePattern:
      mode === 'write' ? 'disjoint targets per connection, alternating high/medium' : null,
    requestsPerSecond: result.requests.average,
    successfulResponses: result['2xx'],
    non2xx: result.non2xx,
    errors: result.errors,
    timeouts: result.timeouts,
    statusCounts,
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
    latencySampleCount: successfulLatencies.length,
    percentileMethod: 'nearest rank from successful response event durations in milliseconds',
    throughputBytesPerSecond: result.throughput.average,
    generatorCpuSeconds: { user: generatorCpu.user / 1e6, system: generatorCpu.system / 1e6 },
    valid:
      successfulLatencies.length > 0 &&
      result.non2xx === 0 &&
      result.errors === 0 &&
      result.timeouts === 0,
  };
  const output = getArg('output', '');
  if (output) {
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(summary, null, 2) + '\n');
  }
  console.log('\n=== Benchmark Summary ===');
  console.log(`Requests/sec (avg): ${result.requests.average}`);
  console.log(`Latency p50 (ms):   ${summary.latencyMs.p50}`);
  console.log(`Latency p95 (ms):   ${summary.latencyMs.p95}`);
  console.log(`Latency p99 (ms):   ${summary.latencyMs.p99}`);
  console.log(`2xx responses:      ${result['2xx']}`);
  console.log(`Non-2xx responses:  ${result.non2xx}`);
  console.log(`Errors / timeouts:  ${result.errors} / ${result.timeouts}`);
  if (!summary.valid) throw new Error('Invalid benchmark: failures or no successful responses');
}

run().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
