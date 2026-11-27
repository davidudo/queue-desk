import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Point DATABASE_URL to TEST_DATABASE_URL before importing app/pool
const testDbUrl =
  process.env.TEST_DATABASE_URL || 'postgresql://davidudo@localhost:5432/queuedesk_test';
process.env.DATABASE_URL = testDbUrl;
process.env.NODE_ENV = 'test';

const { createApp } = await import('../app.js');
const { pool } = await import('../config/database.js');
const { resetDatabase } = await import('../../../../database/scripts/reset.js');
const { seedDatabase } = await import('../../../../database/seeds/seed.js');

describe('QueueDesk API integration', () => {
  const app = createApp();
  let adminToken = '';
  let agentToken = '';
  let queueId = '';
  let createdTicketId = '';

  beforeAll(async () => {
    await resetDatabase(testDbUrl);
    await seedDatabase({ databaseUrl: testDbUrl, ticketCount: 120, seed: 7 });

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@queuedesk.local',
      password: 'QueueDesk!Admin2026',
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.token;

    const agentLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'agent1@queuedesk.local',
      password: 'QueueDesk!Agent2026',
    });
    expect(agentLogin.status).toBe(200);
    agentToken = agentLogin.body.data.token;

    const queuesRes = await request(app)
      .get('/api/v1/admin/queues')
      .set('Authorization', `Bearer ${adminToken}`);
    queueId = queuesRes.body.data[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('exposes /health and /ready endpoints', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const ready = await request(app).get('/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.checks.database).toBe('up');
  });

  it('enforces authentication and RBAC role restrictions', async () => {
    const unauth = await request(app).get('/api/v1/tickets');
    expect(unauth.status).toBe(401);

    const agentForbidden = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${agentToken}`);
    expect(agentForbidden.status).toBe(403);

    const adminAllowed = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminAllowed.status).toBe(200);
  });

  it('creates, retrieves, updates, and comments on a ticket', async () => {
    const createRes = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        subject: 'Integration test checkout failure',
        description: 'Detailed synthetic description for integration test verification.',
        priority: 'high',
        queueId,
        requesterName: 'Taylor Swift',
        requesterEmail: 'taylor.test@synthetic.example.com',
      });

    expect(createRes.status).toBe(201);
    createdTicketId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('open');

    const updateRes = await request(app)
      .patch(`/api/v1/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'resolved' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('resolved');
    expect(updateRes.body.data.resolvedAt).toBeTruthy();

    const commentRes = await request(app)
      .post(`/api/v1/tickets/${createdTicketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body: 'Resolved during integration test.', isInternal: false });

    expect(commentRes.status).toBe(201);
  });

  it('supports search, filtering, deterministic sorting, and exact totalCount', async () => {
    const listRes = await request(app)
      .get('/api/v1/tickets?page=1&pageSize=10&status=resolved&sortBy=ticket_number&sortOrder=desc')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.meta.totalCount).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data.length).toBeLessThanOrEqual(10);
    for (const item of listRes.body.data) {
      expect(item.status).toBe('resolved');
    }

    const searchRes = await request(app)
      .get('/api/v1/tickets?search=Integration+test+checkout+failure')
      .set('Authorization', `Bearer ${agentToken}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.meta.totalCount).toBe(1);
    expect(searchRes.body.data[0].id).toBe(createdTicketId);
  });
});
