import type pg from 'pg';
import { pick, pickWeighted, type Rng } from '../config.js';
import {
  INTERNAL_COMMENTS,
  ISSUE_SCENARIOS,
  PUBLIC_COMMENTS,
  type SyntheticCustomer,
} from '../data.js';

const PRIORITY_WEIGHTS = [
  { value: 'low', weight: 22 },
  { value: 'medium', weight: 46 },
  { value: 'high', weight: 23 },
  { value: 'urgent', weight: 9 },
] as const;

const RECENT_STATUS_WEIGHTS = [
  { value: 'open', weight: 42 },
  { value: 'in_progress', weight: 30 },
  { value: 'pending', weight: 16 },
  { value: 'resolved', weight: 10 },
  { value: 'closed', weight: 2 },
] as const;

const HISTORICAL_STATUS_WEIGHTS = [
  { value: 'open', weight: 8 },
  { value: 'in_progress', weight: 10 },
  { value: 'pending', weight: 10 },
  { value: 'resolved', weight: 46 },
  { value: 'closed', weight: 26 },
] as const;

interface SampledTicket {
  id: string;
  status: string;
  assignedAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export async function seedTicketsAndRelations(
  client: pg.Client,
  params: {
    ticketCount: number;
    customers: SyntheticCustomer[];
    userIds: string[];
    agentIds: string[];
    weightedQueues: Array<{ value: string; weight: number }>;
    tagIds: string[];
    nowMs: number;
    rng: Rng;
  },
): Promise<{ totalComments: number; totalActivity: number }> {
  const { ticketCount, customers, userIds, agentIds, weightedQueues, tagIds, nowMs, rng } = params;
  const maxAgeMs = 365 * 24 * 60 * 60 * 1000;
  const BATCH_SIZE = 5000;

  let insertedTotal = 0;
  const sampleTickets: SampledTicket[] = [];
  const maxSamples = Math.min(40_000, ticketCount);

  while (insertedTotal < ticketCount) {
    const currentBatch = Math.min(BATCH_SIZE, ticketCount - insertedTotal);

    const subjects: string[] = new Array(currentBatch);
    const descriptions: string[] = new Array(currentBatch);
    const statuses: string[] = new Array(currentBatch);
    const priorities: string[] = new Array(currentBatch);
    const queueIds: string[] = new Array(currentBatch);
    const assignedAgentIds: Array<string | null> = new Array(currentBatch);
    const createdByUserIds: string[] = new Array(currentBatch);
    const requesterNames: string[] = new Array(currentBatch);
    const requesterEmails: string[] = new Array(currentBatch);
    const resolvedAts: Array<Date | null> = new Array(currentBatch);
    const createdAts: Date[] = new Array(currentBatch);
    const updatedAts: Date[] = new Array(currentBatch);

    for (let i = 0; i < currentBatch; i++) {
      const globalIdx = insertedTotal + i + 1;
      const scenario = pick(ISSUE_SCENARIOS, rng);

      const custIdx =
        rng() < 0.35
          ? Math.floor(
              rng() * Math.min(customers.length, Math.max(50, Math.floor(customers.length * 0.1))),
            )
          : Math.floor(rng() * customers.length);
      const customer = customers[custIdx]!;

      const ageFactor = Math.pow(rng(), 1.4);
      const ageMs = Math.floor(ageFactor * maxAgeMs);
      const createdAt = new Date(nowMs - ageMs);
      const isRecent = ageMs < 14 * 86400_000;

      const status = pickWeighted(
        isRecent ? RECENT_STATUS_WEIGHTS : HISTORICAL_STATUS_WEIGHTS,
        rng,
      );
      const priority = pickWeighted(PRIORITY_WEIGHTS, rng);
      const queueId = pickWeighted(weightedQueues, rng);

      const isAssigned = status === 'open' ? rng() > 0.32 : rng() > 0.05;
      const assignedAgentId = isAssigned ? pick(agentIds, rng) : null;
      const createdBy = pick(userIds, rng);

      const deltaMs = Math.floor(rng() * Math.min(ageMs, 5 * 86400_000));
      const updatedAt = new Date(createdAt.getTime() + deltaMs);
      const resolvedAt =
        status === 'resolved' || status === 'closed' ? new Date(updatedAt.getTime()) : null;

      const workspaceId = `ws_${((globalIdx * 7919) % 90000) + 10000}`;

      subjects[i] = `[${customer.company}] ${scenario.subject} (#${globalIdx})`;
      descriptions[i] =
        `Product: FlowOps by Northstar Cloud\n\n${scenario.details}\n\n` +
        `Environment: ${scenario.component} | Workspace: ${workspaceId} | Error Code: ${scenario.error}\n` +
        `Reported by ${customer.name} (${customer.company}) — Ticket Ref #${globalIdx}.`;
      statuses[i] = status;
      priorities[i] = priority;
      queueIds[i] = queueId;
      assignedAgentIds[i] = assignedAgentId;
      createdByUserIds[i] = createdBy;
      requesterNames[i] = customer.name;
      requesterEmails[i] = customer.email;
      resolvedAts[i] = resolvedAt;
      createdAts[i] = createdAt;
      updatedAts[i] = updatedAt;
    }

    const { rows: insertedRows } = await client.query<{ id: string }>(
      `INSERT INTO tickets (
        subject, description, status, priority, queue_id,
        assigned_agent_id, created_by_user_id, requester_name,
        requester_email, resolved_at, created_at, updated_at
      )
      SELECT * FROM UNNEST (
        $1::varchar[], $2::text[], $3::varchar[], $4::varchar[], $5::uuid[],
        $6::uuid[], $7::uuid[], $8::varchar[], $9::varchar[],
        $10::timestamptz[], $11::timestamptz[], $12::timestamptz[]
      )
      RETURNING id`,
      [
        subjects,
        descriptions,
        statuses,
        priorities,
        queueIds,
        assignedAgentIds,
        createdByUserIds,
        requesterNames,
        requesterEmails,
        resolvedAts,
        createdAts,
        updatedAts,
      ],
    );

    const tagTicketIds: string[] = [];
    const tagRefs: string[] = [];

    for (let i = 0; i < insertedRows.length; i++) {
      const tId = insertedRows[i]!.id;
      if (rng() < 0.68) {
        const t1 = pick(tagIds, rng);
        tagTicketIds.push(tId);
        tagRefs.push(t1);
        if (rng() < 0.4) {
          const t2 = pick(tagIds, rng);
          if (t2 !== t1) {
            tagTicketIds.push(tId);
            tagRefs.push(t2);
          }
        }
      }

      if (sampleTickets.length < maxSamples && (ticketCount <= 40_000 || rng() < 0.25)) {
        sampleTickets.push({
          id: tId,
          status: statuses[i]!,
          assignedAgentId: assignedAgentIds[i]!,
          createdAt: createdAts[i]!,
          updatedAt: updatedAts[i]!,
          createdBy: createdByUserIds[i]!,
        });
      }
    }

    if (tagTicketIds.length > 0) {
      await client.query(
        `INSERT INTO ticket_tags (ticket_id, tag_id)
         SELECT * FROM UNNEST($1::uuid[], $2::uuid[])
         ON CONFLICT DO NOTHING`,
        [tagTicketIds, tagRefs],
      );
    }

    insertedTotal += currentBatch;
    if (ticketCount >= 50_000 && insertedTotal % 50_000 === 0) {
      console.log(
        `  Inserted ${insertedTotal.toLocaleString()} / ${ticketCount.toLocaleString()} tickets...`,
      );
    }
  }

  return seedCommentsAndActivity(client, sampleTickets, userIds, rng);
}

async function seedCommentsAndActivity(
  client: pg.Client,
  sampleTickets: SampledTicket[],
  userIds: string[],
  rng: Rng,
): Promise<{ totalComments: number; totalActivity: number }> {
  if (sampleTickets.length === 0) {
    return { totalComments: 0, totalActivity: 0 };
  }

  const commentTicketIds: string[] = [];
  const commentAuthorIds: string[] = [];
  const commentBodies: string[] = [];
  const commentInternals: boolean[] = [];
  const commentCreatedAts: Date[] = [];

  const actTicketIds: string[] = [];
  const actActorIds: string[] = [];
  const actActions: string[] = [];
  const actFields: Array<string | null> = [];
  const actOlds: Array<string | null> = [];
  const actNews: Array<string | null> = [];
  const actCreatedAts: Date[] = [];

  for (const item of sampleTickets) {
    actTicketIds.push(item.id);
    actActorIds.push(item.createdBy);
    actActions.push('ticket_created');
    actFields.push('status');
    actOlds.push(null);
    actNews.push('open');
    actCreatedAts.push(item.createdAt);

    if (item.assignedAgentId) {
      actTicketIds.push(item.id);
      actActorIds.push(pick(userIds, rng));
      actActions.push('assignee_changed');
      actFields.push('assigned_agent_id');
      actOlds.push(null);
      actNews.push(item.assignedAgentId);
      actCreatedAts.push(new Date(item.createdAt.getTime() + 15 * 60_000));
    }

    if (item.status !== 'open') {
      actTicketIds.push(item.id);
      actActorIds.push(pick(userIds, rng));
      actActions.push('status_changed');
      actFields.push('status');
      actOlds.push('open');
      actNews.push(item.status);
      actCreatedAts.push(item.updatedAt);
    }

    const numComments =
      item.status === 'open' ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
    for (let c = 0; c < numComments; c++) {
      const isInternal = c === 1 || rng() < 0.3;
      commentTicketIds.push(item.id);
      commentAuthorIds.push(pick(userIds, rng));
      commentBodies.push(isInternal ? pick(INTERNAL_COMMENTS, rng) : pick(PUBLIC_COMMENTS, rng));
      commentInternals.push(isInternal);
      commentCreatedAts.push(new Date(item.createdAt.getTime() + (c + 1) * 1800_000));
    }
  }

  const CHUNK = 10_000;
  for (let i = 0; i < commentTicketIds.length; i += CHUNK) {
    await client.query(
      `INSERT INTO comments (ticket_id, author_id, body, is_internal, created_at)
       SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::text[], $4::boolean[], $5::timestamptz[])`,
      [
        commentTicketIds.slice(i, i + CHUNK),
        commentAuthorIds.slice(i, i + CHUNK),
        commentBodies.slice(i, i + CHUNK),
        commentInternals.slice(i, i + CHUNK),
        commentCreatedAts.slice(i, i + CHUNK),
      ],
    );
  }

  for (let i = 0; i < actTicketIds.length; i += CHUNK) {
    await client.query(
      `INSERT INTO ticket_activity (ticket_id, actor_id, action, field_name, old_value, new_value, created_at)
       SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::varchar[], $4::varchar[], $5::text[], $6::text[], $7::timestamptz[])`,
      [
        actTicketIds.slice(i, i + CHUNK),
        actActorIds.slice(i, i + CHUNK),
        actActions.slice(i, i + CHUNK),
        actFields.slice(i, i + CHUNK),
        actOlds.slice(i, i + CHUNK),
        actNews.slice(i, i + CHUNK),
        actCreatedAts.slice(i, i + CHUNK),
      ],
    );
  }

  return {
    totalComments: commentTicketIds.length,
    totalActivity: actTicketIds.length,
  };
}
