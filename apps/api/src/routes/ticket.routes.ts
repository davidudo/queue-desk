import { Router } from 'express';
import { z } from 'zod';
import {
  createCommentSchema,
  createTicketSchema,
  ticketListQuerySchema,
  ticketTagMutationSchema,
  updateTicketSchema,
  uuidSchema,
} from '@queuedesk/shared';
import { ticketController } from '../controllers/ticket.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { asyncHandler } from '../utils/errors.js';

export const ticketRouter = Router();

const idParamSchema = z.object({ id: uuidSchema });
const ticketTagParamSchema = z.object({ id: uuidSchema, tagId: uuidSchema });

ticketRouter.use(authenticate);

ticketRouter.get(
  '/',
  requirePermission('tickets:read'),
  validateRequest({ query: ticketListQuerySchema }),
  asyncHandler(ticketController.list),
);

ticketRouter.post(
  '/',
  requirePermission('tickets:create'),
  validateRequest({ body: createTicketSchema }),
  asyncHandler(ticketController.create),
);

ticketRouter.get(
  '/:id',
  requirePermission('tickets:read'),
  validateRequest({ params: idParamSchema }),
  asyncHandler(ticketController.getById),
);

ticketRouter.patch(
  '/:id',
  requirePermission('tickets:update'),
  validateRequest({ params: idParamSchema, body: updateTicketSchema }),
  asyncHandler(ticketController.update),
);

ticketRouter.post(
  '/:id/comments',
  requirePermission('tickets:comment'),
  validateRequest({ params: idParamSchema, body: createCommentSchema }),
  asyncHandler(ticketController.addComment),
);

ticketRouter.post(
  '/:id/tags',
  requirePermission('tickets:update'),
  validateRequest({ params: idParamSchema, body: ticketTagMutationSchema }),
  asyncHandler(ticketController.addTag),
);

ticketRouter.delete(
  '/:id/tags/:tagId',
  requirePermission('tickets:update'),
  validateRequest({ params: ticketTagParamSchema }),
  asyncHandler(ticketController.removeTag),
);
