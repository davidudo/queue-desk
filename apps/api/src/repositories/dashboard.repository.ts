import type { DashboardSummaryDTO, TicketPriority, TicketStatus } from '@queuedesk/shared';
import { pool } from '../config/database.js';
import { ticketRepository } from './ticket.repository.js';

export const dashboardRepository = {
  async getSummary(): Promise<DashboardSummaryDTO> {
    const [statusRes, priorityRes, queueRes, workloadRes, recentTickets] = await Promise.all([
      pool.query<{ status: TicketStatus; count: number }>(
        `SELECT status, COUNT(*)::int AS count FROM tickets GROUP BY status`,
      ),
      pool.query<{ priority: TicketPriority; count: number }>(
        `SELECT priority, COUNT(*)::int AS count FROM tickets GROUP BY priority`,
      ),
      pool.query<{ queue_id: string; queue_name: string; count: number }>(
        `SELECT q.id AS queue_id, q.name AS queue_name, COUNT(t.id)::int AS count
         FROM queues q
         LEFT JOIN tickets t ON t.queue_id = q.id
         GROUP BY q.id, q.name
         ORDER BY count DESC, q.name ASC`,
      ),
      pool.query<{
        agent_id: string;
        full_name: string;
        department: string;
        max_capacity: number;
        is_available: boolean;
        active_tickets: number;
      }>(
        `SELECT
           a.id AS agent_id,
           u.full_name,
           a.department,
           a.max_capacity,
           a.is_available,
           COUNT(t.id) FILTER (WHERE t.status IN ('open', 'in_progress', 'pending'))::int AS active_tickets
         FROM agents a
         JOIN users u ON u.id = a.user_id
         LEFT JOIN tickets t ON t.assigned_agent_id = a.id
         GROUP BY a.id, u.full_name, a.department, a.max_capacity, a.is_available
         ORDER BY active_tickets DESC, u.full_name ASC
         LIMIT 12`,
      ),
      ticketRepository.listTickets({
        page: 1,
        pageSize: 6,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      }),
    ]);

    const statusCounts = new Map(statusRes.rows.map((r) => [r.status, r.count]));
    const open = statusCounts.get('open') ?? 0;
    const inProgress = statusCounts.get('in_progress') ?? 0;
    const pending = statusCounts.get('pending') ?? 0;
    const resolved = statusCounts.get('resolved') ?? 0;
    const closed = statusCounts.get('closed') ?? 0;

    return {
      totals: {
        all: open + inProgress + pending + resolved + closed,
        open,
        inProgress,
        pending,
        resolved,
        closed,
      },
      byPriority: priorityRes.rows.map((r) => ({
        priority: r.priority,
        count: r.count,
      })),
      byQueue: queueRes.rows.map((r) => ({
        queueId: r.queue_id,
        queueName: r.queue_name,
        count: r.count,
      })),
      recentlyUpdated: recentTickets.items,
      agentWorkload: workloadRes.rows.map((r) => ({
        agentId: r.agent_id,
        fullName: r.full_name,
        department: r.department,
        activeTickets: r.active_tickets,
        maxCapacity: r.max_capacity,
        isAvailable: r.is_available,
      })),
    };
  },
};
