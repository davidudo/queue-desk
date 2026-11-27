export const ROLES = ['admin', 'supervisor', 'support_agent'] as const;
export type RoleName = (typeof ROLES)[number];

export const TICKET_STATUSES = ['open', 'in_progress', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_SORT_FIELDS = [
  'created_at',
  'updated_at',
  'priority',
  'status',
  'ticket_number',
] as const;
export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const PERMISSIONS = [
  'dashboard:read',
  'tickets:read',
  'tickets:create',
  'tickets:update',
  'tickets:assign',
  'tickets:resolve',
  'tickets:comment',
  'queues:read',
  'queues:manage',
  'tags:read',
  'tags:manage',
  'agents:read',
  'agents:manage',
  'users:read',
  'users:manage',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  admin: PERMISSIONS,
  supervisor: [
    'dashboard:read',
    'tickets:read',
    'tickets:create',
    'tickets:update',
    'tickets:assign',
    'tickets:resolve',
    'tickets:comment',
    'queues:read',
    'queues:manage',
    'tags:read',
    'tags:manage',
    'agents:read',
    'agents:manage',
    'users:read',
    'audit:read',
  ],
  support_agent: [
    'dashboard:read',
    'tickets:read',
    'tickets:create',
    'tickets:update',
    'tickets:assign',
    'tickets:resolve',
    'tickets:comment',
    'queues:read',
    'tags:read',
    'agents:read',
  ],
};
