import type pg from 'pg';
import { hashPasswordSync, pick, type Rng } from '../config.js';
import { DEPARTMENTS, FIRST_NAMES, LAST_NAMES } from '../data.js';

export interface SeededUsersResult {
  userIds: string[];
  agentIds: string[];
  emails: string[];
}

export async function seedUsersAndAgents(
  client: pg.Client,
  roleMap: Map<string, string>,
  rng: Rng,
): Promise<SeededUsersResult> {
  const devUsers: Array<{
    email: string;
    fullName: string;
    passwordHash: string;
    role: 'admin' | 'supervisor' | 'support_agent';
    department: string;
    capacity: number;
    isAvailable: boolean;
  }> = [
    {
      email: 'admin@queuedesk.local',
      fullName: 'Elena Vance (Admin)',
      passwordHash: hashPasswordSync('QueueDesk!Admin2026'),
      role: 'admin',
      department: 'Northstar Cloud Operations',
      capacity: 15,
      isAvailable: true,
    },
    {
      email: 'supervisor@queuedesk.local',
      fullName: 'Marcus Sterling (Supervisor)',
      passwordHash: hashPasswordSync('QueueDesk!Super2026'),
      role: 'supervisor',
      department: 'Customer Escalations',
      capacity: 25,
      isAvailable: true,
    },
    {
      email: 'agent1@queuedesk.local',
      fullName: 'Priya Nair',
      passwordHash: hashPasswordSync('QueueDesk!Agent2026'),
      role: 'support_agent',
      department: 'Technical Support',
      capacity: 40,
      isAvailable: true,
    },
    {
      email: 'agent2@queuedesk.local',
      fullName: 'Lucas Meyer',
      passwordHash: hashPasswordSync('QueueDesk!Agent2026'),
      role: 'support_agent',
      department: 'Billing & Payments',
      capacity: 35,
      isAvailable: true,
    },
  ];

  const sharedAgentHash = hashPasswordSync('QueueDesk!Agent2026');
  const sharedSuperHash = hashPasswordSync('QueueDesk!Super2026');

  for (let i = 3; i <= 36; i++) {
    const first = pick(FIRST_NAMES, rng);
    const last = pick(LAST_NAMES, rng);
    const isSupervisor = i <= 6;
    devUsers.push({
      email: `${isSupervisor ? 'supervisor' : 'agent'}${i}@queuedesk.local`,
      fullName: `${first} ${last}`,
      passwordHash: isSupervisor ? sharedSuperHash : sharedAgentHash,
      role: isSupervisor ? 'supervisor' : 'support_agent',
      department: DEPARTMENTS[i % DEPARTMENTS.length]!,
      capacity: 25 + (i % 5) * 5,
      isAvailable: rng() > 0.1,
    });
  }

  const userIds: string[] = [];
  const agentIds: string[] = [];
  const emails: string[] = [];

  for (const u of devUsers) {
    const { rows: uRows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, full_name, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [u.email, u.fullName, u.passwordHash, roleMap.get(u.role)],
    );
    const userId = uRows[0]!.id;
    userIds.push(userId);
    emails.push(u.email);

    const { rows: aRows } = await client.query<{ id: string }>(
      `INSERT INTO agents (user_id, department, max_capacity, is_available)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, u.department, u.capacity, u.isAvailable],
    );
    agentIds.push(aRows[0]!.id);
  }

  return { userIds, agentIds, emails };
}
