import path from 'node:path';
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

  let targetUrl = `${baseUrl}/api/v1/tickets?${query}`;
  let method: 'GET' | 'PATCH' = 'GET';
  let body: string | undefined;

  if (mode === 'write') {
    const listRes = await fetch(`${baseUrl}/api/v1/tickets?page=1&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listJson = (await listRes.json()) as { data: Array<{ id: string }> };
    const sampleId = listJson.data[0]?.id;
    if (!sampleId) {
      throw new Error('No tickets found to benchmark write path');
    }
    targetUrl = `${baseUrl}/api/v1/tickets/${sampleId}`;
    method = 'PATCH';
    body = JSON.stringify({ priority: 'high' });
  }

  console.log(
    `Running Autocannon (${mode.toUpperCase()}) -> ${targetUrl} | connections=${connections}, duration=${duration}s`,
  );

  const result = await autocannon({
    url: targetUrl,
    method,
    body,
    connections,
    duration,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  console.log('\n=== Benchmark Summary ===');
  console.log(`Requests/sec (avg): ${result.requests.average}`);
  console.log(`Latency p50 (ms):   ${result.latency.p50}`);
  console.log(`Latency p95 (ms):   ${result.latency.p97_5}`);
  console.log(`Latency p99 (ms):   ${result.latency.p99}`);
  console.log(`2xx responses:      ${result['2xx']}`);
  console.log(`Non-2xx responses:  ${result.non2xx}`);
  console.log(`Errors / timeouts:  ${result.errors} / ${result.timeouts}`);
}

run().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
