import type {
  AuthUser,
  CreateCommentInput,
  CreateTicketInput,
  TicketListQuery,
  UpdateTicketInput,
} from '@queuedesk/shared';
import { ticketRepository } from '../repositories/ticket.repository.js';

export const ticketService = {
  async listTickets(query: TicketListQuery) {
    const { items, totalCount } = await ticketRepository.listTickets(query);
    const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
    return {
      items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount,
        totalPages,
      },
    };
  },

  async getTicketById(id: string) {
    return ticketRepository.getTicketById(id);
  },

  async createTicket(input: CreateTicketInput, actor: AuthUser) {
    return ticketRepository.createTicket(input, actor.id);
  },

  async updateTicket(id: string, input: UpdateTicketInput, actor: AuthUser) {
    return ticketRepository.updateTicket(id, input, actor.id);
  },

  async addComment(ticketId: string, input: CreateCommentInput, actor: AuthUser) {
    return ticketRepository.addComment(ticketId, input, actor.id);
  },

  async addTag(ticketId: string, tagId: string, actor: AuthUser) {
    return ticketRepository.addTag(ticketId, tagId, actor.id);
  },

  async removeTag(ticketId: string, tagId: string, actor: AuthUser) {
    return ticketRepository.removeTag(ticketId, tagId, actor.id);
  },
};
