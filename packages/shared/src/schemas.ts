import { z } from 'zod';
import {
  ROLES,
  SORT_ORDERS,
  TICKET_PRIORITIES,
  TICKET_SORT_FIELDS,
  TICKET_STATUSES,
} from './constants.js';

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(10000),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
  queueId: uuidSchema,
  assignedAgentId: uuidSchema.nullable().optional(),
  requesterName: z.string().trim().min(2).max(120),
  requesterEmail: z.string().trim().email().max(255),
  tagIds: z.array(uuidSchema).max(10).optional().default([]),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z
  .object({
    subject: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(10).max(10000).optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    queueId: uuidSchema.optional(),
    assignedAgentId: uuidSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const ticketListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  queueId: uuidSchema.optional(),
  assignedAgentId: uuidSchema.optional(),
  unassigned: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  tagId: uuidSchema.optional(),
  sortBy: z.enum(TICKET_SORT_FIELDS).default('created_at'),
  sortOrder: z.enum(SORT_ORDERS).default('desc'),
});
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
  isInternal: z.boolean().default(false),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const ticketTagMutationSchema = z.object({
  tagId: uuidSchema,
});
export type TicketTagMutationInput = z.infer<typeof ticketTagMutationSchema>;

export const createQueueSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().trim().max(500).optional().default(''),
  isActive: z.boolean().optional().default(true),
});
export type CreateQueueInput = z.infer<typeof createQueueSchema>;

export const updateQueueSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>;

export const createTagSchema = z.object({
  name: z.string().trim().min(2).max(50),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex code')
    .default('#6366f1'),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(ROLES),
  isActive: z.boolean().optional(),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(128),
  role: z.enum(ROLES),
  department: z.string().trim().min(2).max(80).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateAgentSchema = z.object({
  department: z.string().trim().min(2).max(80).optional(),
  maxCapacity: z.coerce.number().int().min(1).max(500).optional(),
  isAvailable: z.boolean().optional(),
});
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().trim().max(100).optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
