import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, RotateCcw, Tag as TagIcon } from 'lucide-react';
import {
  createCommentSchema,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AgentDTO,
  type CreateCommentInput,
  type QueueDTO,
  type TagDTO,
  type TicketDetailDTO,
  type UpdateTicketInput,
} from '@queuedesk/shared';
import {
  Button,
  Card,
  ConfirmDialog,
  PriorityBadge,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
} from '@/components/ui/primitives';
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/lib/toast-context';
import { formatDateTime, formatStatusLabel } from '@/lib/utils';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmResolveOpen, setConfirmResolveOpen] = useState(false);

  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => (await apiRequest<TicketDetailDTO>(`/tickets/${id}`)).data,
    enabled: Boolean(id),
  });

  const queuesQuery = useQuery({
    queryKey: ['admin-queues'],
    queryFn: async () => (await apiRequest<QueueDTO[]>('/admin/queues')).data,
  });

  const agentsQuery = useQuery({
    queryKey: ['admin-agents'],
    queryFn: async () => (await apiRequest<AgentDTO[]>('/admin/agents')).data,
  });

  const tagsQuery = useQuery({
    queryKey: ['admin-tags'],
    queryFn: async () => (await apiRequest<TagDTO[]>('/admin/tags')).data,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateTicketInput) =>
      (
        await apiRequest<TicketDetailDTO>(`/tickets/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      ).data,
    onSuccess: (updated) => {
      queryClient.setQueryData(['ticket', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast('Ticket updated');
      setConfirmResolveOpen(false);
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) =>
      (
        await apiRequest<TicketDetailDTO>(`/tickets/${id}/tags`, {
          method: 'POST',
          body: JSON.stringify({ tagId }),
        })
      ).data,
    onSuccess: (updated) => {
      queryClient.setQueryData(['ticket', id], updated);
      toast('Tag added');
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) =>
      (await apiRequest<TicketDetailDTO>(`/tickets/${id}/tags/${tagId}`, { method: 'DELETE' }))
        .data,
    onSuccess: (updated) => {
      queryClient.setQueryData(['ticket', id], updated);
      toast('Tag removed');
    },
  });

  const commentForm = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: { body: '', isInternal: false },
  });

  const commentMutation = useMutation({
    mutationFn: async (values: CreateCommentInput) =>
      apiRequest(`/tickets/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      commentForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast('Comment posted');
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to post comment', 'error');
    },
  });

  if (ticketQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <Card className="p-6 text-destructive">
        Unable to load ticket details.{' '}
        <Link to="/tickets" className="underline">
          Back to tickets
        </Link>
      </Card>
    );
  }

  const ticket = ticketQuery.data;
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  const availableTags = (tagsQuery.data ?? []).filter(
    (t) => !ticket.tags.some((existing) => existing.id === t.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/tickets"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to tickets
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              #{ticket.ticketNumber} {ticket.subject}
            </h1>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isResolved ? (
            <Button
              variant="outline"
              onClick={() => updateMutation.mutate({ status: 'open' })}
              disabled={updateMutation.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              Reopen Ticket
            </Button>
          ) : (
            <Button onClick={() => setConfirmResolveOpen(true)}>
              <CheckCircle2 className="h-4 w-4" />
              Resolve Ticket
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Description, Comments, Activity */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Requester: <strong className="text-foreground">{ticket.requesterName}</strong> (
                {ticket.requesterEmail})
              </span>
              <span>Created {formatDateTime(ticket.createdAt)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </Card>

          {/* Comments */}
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-semibold">Conversation ({ticket.comments.length})</h2>
            <div className="space-y-3">
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                ticket.comments.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-md border p-3 text-sm ${
                      c.isInternal ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">
                        {c.authorName}
                        {c.isInternal && (
                          <span className="ml-2 rounded bg-amber-200/70 dark:bg-amber-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            Internal Note
                          </span>
                        )}
                      </span>
                      <span>{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={commentForm.handleSubmit((v) => commentMutation.mutate(v))}
              className="space-y-3 border-t pt-4"
            >
              <Textarea
                aria-label="Add a comment"
                placeholder="Write a reply or internal note..."
                {...commentForm.register('body')}
              />
              {commentForm.formState.errors.body && (
                <p className="text-xs text-destructive">
                  {commentForm.formState.errors.body.message}
                </p>
              )}
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" {...commentForm.register('isInternal')} />
                  Internal note (visible to support team only)
                </label>
                <Button type="submit" size="sm" disabled={commentMutation.isPending}>
                  {commentMutation.isPending ? 'Posting...' : 'Post Comment'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Activity History */}
          <Card className="p-5 space-y-3">
            <h2 className="text-base font-semibold">Activity History</h2>
            <ul className="space-y-2 text-xs">
              {ticket.activity.map((act) => (
                <li
                  key={act.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <span>
                    <strong>{act.actorName}</strong> performed{' '}
                    <code className="rounded bg-muted px-1 py-0.5">{act.action}</code>
                    {act.newValue ? ` → ${act.newValue}` : ''}
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(act.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Right: Metadata & Controls */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-semibold">Ticket Properties</h2>

            <div className="space-y-1">
              <label htmlFor="detail-status" className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select
                id="detail-status"
                aria-label="Status"
                value={ticket.status}
                onValueChange={(val) =>
                  updateMutation.mutate({ status: val as TicketDetailDTO['status'] })
                }
                options={TICKET_STATUSES.map((s) => ({
                  value: s,
                  label: formatStatusLabel(s),
                }))}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="detail-priority"
                className="text-xs font-medium text-muted-foreground"
              >
                Priority
              </label>
              <Select
                id="detail-priority"
                aria-label="Priority"
                value={ticket.priority}
                onValueChange={(val) =>
                  updateMutation.mutate({ priority: val as TicketDetailDTO['priority'] })
                }
                options={TICKET_PRIORITIES.map((p) => ({
                  value: p,
                  label: p.toUpperCase(),
                }))}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="detail-queue" className="text-xs font-medium text-muted-foreground">
                Support Queue
              </label>
              <Select
                id="detail-queue"
                aria-label="Support Queue"
                value={ticket.queueId}
                onValueChange={(val) => updateMutation.mutate({ queueId: val })}
                options={(queuesQuery.data ?? []).map((q) => ({
                  value: q.id,
                  label: q.name,
                }))}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="detail-assignee"
                className="text-xs font-medium text-muted-foreground"
              >
                Assigned Agent
              </label>
              <Select
                id="detail-assignee"
                aria-label="Assigned Agent"
                value={ticket.assignedAgentId ?? ''}
                onValueChange={(val) => updateMutation.mutate({ assignedAgentId: val || null })}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...(agentsQuery.data ?? []).map((a) => ({
                    value: a.id,
                    label: a.fullName,
                    description: a.department,
                  })),
                ]}
              />
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TagIcon className="h-3.5 w-3.5" /> Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ticket.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag.name}`}
                      onClick={() => removeTagMutation.mutate(tag.id)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {availableTags.length > 0 && (
                <Select
                  aria-label="Add tag"
                  value=""
                  placeholder="+ Add tag..."
                  onValueChange={(val) => {
                    if (val) addTagMutation.mutate(val);
                  }}
                  options={availableTags.map((t) => ({
                    value: t.id,
                    label: t.name,
                  }))}
                />
              )}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmResolveOpen}
        onClose={() => setConfirmResolveOpen(false)}
        onConfirm={() => updateMutation.mutate({ status: 'resolved' })}
        title="Resolve Ticket"
        message={`Mark ticket #${ticket.ticketNumber} as resolved?`}
        confirmLabel="Resolve"
        isPending={updateMutation.isPending}
      />
    </div>
  );
}
