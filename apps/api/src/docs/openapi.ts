export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'QueueDesk Support Ticket API',
    version: '1.0.0',
    description: 'Versioned REST API for QueueDesk internal support ticket management platform.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'qd_token',
      },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate user and issue session token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Authenticated session created' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke current session',
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get authenticated user profile',
        responses: { '200': { description: 'Current user' } },
      },
    },
    '/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Retrieve ticket summary counts, queue distribution, and agent workload',
        responses: { '200': { description: 'Dashboard summary' } },
      },
    },
    '/tickets': {
      get: {
        tags: ['Tickets'],
        summary: 'List tickets with search, filtering, sorting, and exact total count',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['open', 'in_progress', 'pending', 'resolved', 'closed'],
            },
          },
          {
            name: 'priority',
            in: 'query',
            schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          },
          { name: 'queueId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'assignedAgentId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'tagId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          {
            name: 'sortBy',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['created_at', 'updated_at', 'priority', 'status', 'ticket_number'],
            },
          },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: { '200': { description: 'Paginated ticket list with exact totalCount' } },
      },
      post: {
        tags: ['Tickets'],
        summary: 'Create a new support ticket',
        responses: { '201': { description: 'Ticket created' } },
      },
    },
    '/tickets/{id}': {
      get: {
        tags: ['Tickets'],
        summary: 'Get full ticket details including comments and activity history',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Ticket detail' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['Tickets'],
        summary: 'Update ticket details, status, priority, queue, or assignee',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Ticket updated' } },
      },
    },
    '/tickets/{id}/comments': {
      post: {
        tags: ['Tickets'],
        summary: 'Add a public reply or internal note to a ticket',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '201': { description: 'Comment added' } },
      },
    },
    '/tickets/{id}/tags': {
      post: {
        tags: ['Tickets'],
        summary: 'Attach a tag to a ticket',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Tag attached' } },
      },
    },
    '/tickets/{id}/tags/{tagId}': {
      delete: {
        tags: ['Tickets'],
        summary: 'Remove a tag from a ticket',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'tagId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Tag removed' } },
      },
    },
    '/admin/queues': {
      get: {
        tags: ['Admin'],
        summary: 'List support queues',
        responses: { '200': { description: 'Queues' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a support queue',
        responses: { '201': { description: 'Created' } },
      },
    },
    '/admin/tags': {
      get: { tags: ['Admin'], summary: 'List tags', responses: { '200': { description: 'Tags' } } },
      post: {
        tags: ['Admin'],
        summary: 'Create a tag',
        responses: { '201': { description: 'Created' } },
      },
    },
    '/admin/agents': {
      get: {
        tags: ['Admin'],
        summary: 'List support agents',
        responses: { '200': { description: 'Agents' } },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users',
        responses: { '200': { description: 'Users' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create user',
        responses: { '201': { description: 'Created' } },
      },
    },
    '/admin/audit-logs': {
      get: {
        tags: ['Admin'],
        summary: 'List audit logs',
        responses: { '200': { description: 'Audit logs' } },
      },
    },
  },
};
