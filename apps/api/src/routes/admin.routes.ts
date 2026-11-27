import { Router } from 'express';
import { z } from 'zod';
import {
  auditLogQuerySchema,
  createQueueSchema,
  createTagSchema,
  createUserSchema,
  updateAgentSchema,
  updateQueueSchema,
  updateUserRoleSchema,
  uuidSchema,
} from '@queuedesk/shared';
import { adminController } from '../controllers/admin.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { asyncHandler } from '../utils/errors.js';

export const adminRouter = Router();
const idParamSchema = z.object({ id: uuidSchema });

adminRouter.use(authenticate);

// Queues
adminRouter.get(
  '/queues',
  requirePermission('queues:read'),
  asyncHandler(adminController.listQueues),
);
adminRouter.post(
  '/queues',
  requirePermission('queues:manage'),
  validateRequest({ body: createQueueSchema }),
  asyncHandler(adminController.createQueue),
);
adminRouter.patch(
  '/queues/:id',
  requirePermission('queues:manage'),
  validateRequest({ params: idParamSchema, body: updateQueueSchema }),
  asyncHandler(adminController.updateQueue),
);

// Tags
adminRouter.get('/tags', requirePermission('tags:read'), asyncHandler(adminController.listTags));
adminRouter.post(
  '/tags',
  requirePermission('tags:manage'),
  validateRequest({ body: createTagSchema }),
  asyncHandler(adminController.createTag),
);
adminRouter.delete(
  '/tags/:id',
  requirePermission('tags:manage'),
  validateRequest({ params: idParamSchema }),
  asyncHandler(adminController.deleteTag),
);

// Agents
adminRouter.get(
  '/agents',
  requirePermission('agents:read'),
  asyncHandler(adminController.listAgents),
);
adminRouter.patch(
  '/agents/:id',
  requirePermission('agents:manage'),
  validateRequest({ params: idParamSchema, body: updateAgentSchema }),
  asyncHandler(adminController.updateAgent),
);

// Users & Roles
adminRouter.get('/users', requirePermission('users:read'), asyncHandler(adminController.listUsers));
adminRouter.post(
  '/users',
  requirePermission('users:manage'),
  validateRequest({ body: createUserSchema }),
  asyncHandler(adminController.createUser),
);
adminRouter.patch(
  '/users/:id/role',
  requirePermission('users:manage'),
  validateRequest({ params: idParamSchema, body: updateUserRoleSchema }),
  asyncHandler(adminController.updateUserRole),
);

// Audit Logs
adminRouter.get(
  '/audit-logs',
  requirePermission('audit:read'),
  validateRequest({ query: auditLogQuerySchema }),
  asyncHandler(adminController.listAuditLogs),
);
