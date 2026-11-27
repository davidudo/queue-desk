import type { RoleName, TicketPriority, TicketStatus } from './constants.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
  agentId: string | null;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
  expiresAt: string;
}

export interface QueueDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TagDTO {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface AgentDTO {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: RoleName;
  department: string;
  maxCapacity: number;
  isAvailable: boolean;
  activeTicketCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummaryDTO {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListItemDTO {
  id: string;
  ticketNumber: number;
  subject: string;
  descriptionPreview: string;
  status: TicketStatus;
  priority: TicketPriority;
  queueId: string;
  queueName: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  requesterName: string;
  requesterEmail: string;
  tags: TagDTO[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface TicketCommentDTO {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: RoleName;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketActivityDTO {
  id: string;
  ticketId: string;
  actorId: string | null;
  actorName: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface TicketDetailDTO extends TicketListItemDTO {
  description: string;
  comments: TicketCommentDTO[];
  activity: TicketActivityDTO[];
}

export interface DashboardSummaryDTO {
  totals: {
    all: number;
    open: number;
    inProgress: number;
    pending: number;
    resolved: number;
    closed: number;
  };
  byPriority: Array<{ priority: TicketPriority; count: number }>;
  byQueue: Array<{ queueId: string; queueName: string; count: number }>;
  recentlyUpdated: TicketListItemDTO[];
  agentWorkload: Array<{
    agentId: string;
    fullName: string;
    department: string;
    activeTickets: number;
    maxCapacity: number;
    isAvailable: boolean;
  }>;
}

export interface AuditLogDTO {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: PaginationMeta;
  requestId?: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}
