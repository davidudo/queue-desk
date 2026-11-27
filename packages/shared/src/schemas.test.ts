import { describe, expect, it } from 'vitest';
import { createTicketSchema, ticketListQuerySchema, updateTicketSchema } from './schemas.js';

describe('Shared Zod schemas', () => {
  it('validates ticket creation payload with defaults', () => {
    const parsed = createTicketSchema.parse({
      subject: 'Cannot access billing portal',
      description: 'Customer receives 403 error when opening invoice history.',
      queueId: '11111111-1111-4111-8111-111111111111',
      requesterName: 'Jordan Lee',
      requesterEmail: 'jordan@example.com',
    });

    expect(parsed.priority).toBe('medium');
    expect(parsed.tagIds).toEqual([]);
  });

  it('rejects empty updateTicketSchema payloads', () => {
    const result = updateTicketSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('coerces and clamps ticketListQuerySchema pagination', () => {
    const parsed = ticketListQuerySchema.parse({
      page: '2',
      pageSize: '50',
      sortBy: 'priority',
      sortOrder: 'asc',
    });

    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.sortBy).toBe('priority');
    expect(parsed.sortOrder).toBe('asc');
  });
});
