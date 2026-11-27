import type { Request, Response } from 'express';
import type {
  AuditLogQuery,
  CreateQueueInput,
  CreateTagInput,
  CreateUserInput,
  UpdateAgentInput,
  UpdateQueueInput,
  UpdateUserRoleInput,
} from '@queuedesk/shared';
import { adminRepository } from '../repositories/admin.repository.js';

export const adminController = {
  async listQueues(req: Request, res: Response): Promise<void> {
    const queues = await adminRepository.listQueues();
    res.status(200).json({ data: queues, requestId: req.requestId });
  },

  async createQueue(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateQueueInput;
    const queue = await adminRepository.createQueue(input);
    await adminRepository.insertAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'queue.created',
      entityType: 'queue',
      entityId: queue.id,
      metadata: { name: queue.name, slug: queue.slug },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ data: queue, requestId: req.requestId });
  },

  async updateQueue(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const input = req.body as UpdateQueueInput;
    const queue = await adminRepository.updateQueue(id, input);
    await adminRepository.insertAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'queue.updated',
      entityType: 'queue',
      entityId: queue.id,
      metadata: input,
      ipAddress: req.ip ?? null,
    });
    res.status(200).json({ data: queue, requestId: req.requestId });
  },

  async listTags(req: Request, res: Response): Promise<void> {
    const tags = await adminRepository.listTags();
    res.status(200).json({ data: tags, requestId: req.requestId });
  },

  async createTag(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateTagInput;
    const tag = await adminRepository.createTag(input);
    await adminRepository.insertAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'tag.created',
      entityType: 'tag',
      entityId: tag.id,
      metadata: { name: tag.name },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ data: tag, requestId: req.requestId });
  },

  async deleteTag(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await adminRepository.deleteTag(id);
    await adminRepository.insertAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'tag.deleted',
      entityType: 'tag',
      entityId: id,
      ipAddress: req.ip ?? null,
    });
    res.status(200).json({ data: { deleted: true }, requestId: req.requestId });
  },

  async listAgents(req: Request, res: Response): Promise<void> {
    const agents = await adminRepository.listAgents();
    res.status(200).json({ data: agents, requestId: req.requestId });
  },

  async updateAgent(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const input = req.body as UpdateAgentInput;
    const agent = await adminRepository.updateAgent(id, input);
    await adminRepository.insertAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'agent.updated',
      entityType: 'agent',
      entityId: agent.id,
      metadata: input,
      ipAddress: req.ip ?? null,
    });
    res.status(200).json({ data: agent, requestId: req.requestId });
  },

  async listUsers(req: Request, res: Response): Promise<void> {
    const users = await adminRepository.listUsers();
    res.status(200).json({ data: users, requestId: req.requestId });
  },

  async createUser(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateUserInput;
    const user = await adminRepository.createUser(input);
    await adminRepository.insertAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
      ipAddress: req.ip ?? null,
    });
    res.status(201).json({ data: user, requestId: req.requestId });
  },

  async updateUserRole(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const input = req.body as UpdateUserRoleInput;
    const user = await adminRepository.updateUserRole(id, input);
    await adminRepository.insertAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'user.role_updated',
      entityType: 'user',
      entityId: user.id,
      metadata: input,
      ipAddress: req.ip ?? null,
    });
    res.status(200).json({ data: user, requestId: req.requestId });
  },

  async listAuditLogs(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as AuditLogQuery;
    const { items, totalCount } = await adminRepository.listAuditLogs(query);
    res.status(200).json({
      data: items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
      },
      requestId: req.requestId,
    });
  },
};
