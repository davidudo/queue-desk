import type { Request, Response } from 'express';
import type {
  CreateCommentInput,
  CreateTicketInput,
  TicketListQuery,
  TicketTagMutationInput,
  UpdateTicketInput,
} from '@queuedesk/shared';
import { ticketService } from '../services/ticket.service.js';

export const ticketController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as TicketListQuery;
    const { items, meta } = await ticketService.listTickets(query);
    res.status(200).json({
      data: items,
      meta,
      requestId: req.requestId,
    });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const ticket = await ticketService.getTicketById(req.params.id as string);
    res.status(200).json({
      data: ticket,
      requestId: req.requestId,
    });
  },

  async create(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateTicketInput;
    const created = await ticketService.createTicket(input, req.user!);
    res.status(201).json({
      data: created,
      requestId: req.requestId,
    });
  },

  async update(req: Request, res: Response): Promise<void> {
    const input = req.body as UpdateTicketInput;
    const updated = await ticketService.updateTicket(req.params.id as string, input, req.user!);
    res.status(200).json({
      data: updated,
      requestId: req.requestId,
    });
  },

  async addComment(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateCommentInput;
    const comment = await ticketService.addComment(req.params.id as string, input, req.user!);
    res.status(201).json({
      data: comment,
      requestId: req.requestId,
    });
  },

  async addTag(req: Request, res: Response): Promise<void> {
    const { tagId } = req.body as TicketTagMutationInput;
    const updated = await ticketService.addTag(req.params.id as string, tagId, req.user!);
    res.status(200).json({
      data: updated,
      requestId: req.requestId,
    });
  },

  async removeTag(req: Request, res: Response): Promise<void> {
    const updated = await ticketService.removeTag(
      req.params.id as string,
      req.params.tagId as string,
      req.user!,
    );
    res.status(200).json({
      data: updated,
      requestId: req.requestId,
    });
  },
};
