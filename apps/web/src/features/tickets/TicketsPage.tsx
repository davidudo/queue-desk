import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Plus, Search, X } from 'lucide-react';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AgentDTO,
  type QueueDTO,
  type SortOrder,
  type TagDTO,
  type TicketListItemDTO,
  type TicketSortField,
} from '@queuedesk/shared';
import {
  Button,
  Card,
  Input,
  PriorityBadge,
  Select,
  Skeleton,
  StatusBadge,
} from '@/components/ui/primitives';
import { apiRequest } from '@/lib/api-client';
import { formatDateTime, formatStatusLabel } from '@/lib/utils';
import { CreateTicketDialog } from './CreateTicketDialog';

const columnHelper = createColumnHelper<TicketListItemDTO>();

export function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || '25')));
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const queueId = searchParams.get('queueId') || '';
  const assignedAgentId = searchParams.get('assignedAgentId') || '';
  const tagId = searchParams.get('tagId') || '';
  const sortBy = (searchParams.get('sortBy') as TicketSortField) || 'created_at';
  const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';

  const [searchInput, setSearchInput] = useState(search);

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, val] of Object.entries(updates)) {
      if (!val) {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    }
    if (!('page' in updates)) {
      next.set('page', '1');
    }
    setSearchParams(next);
  }

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

  const ticketsQuery = useQuery({
    queryKey: [
      'tickets',
      {
        page,
        pageSize,
        search,
        status,
        priority,
        queueId,
        assignedAgentId,
        tagId,
        sortBy,
        sortOrder,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
      });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (queueId) params.set('queueId', queueId);
      if (assignedAgentId === 'unassigned') {
        params.set('unassigned', 'true');
      } else if (assignedAgentId) {
        params.set('assignedAgentId', assignedAgentId);
      }
      if (tagId) params.set('tagId', tagId);

      return apiRequest<TicketListItemDTO[]>(`/tickets?${params.toString()}`);
    },
  });

  function toggleSort(field: TicketSortField) {
    if (sortBy === field) {
      updateParams({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ sortBy: field, sortOrder: 'desc' });
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('ticketNumber', {
        header: () => (
          <button
            type="button"
            onClick={() => toggleSort('ticket_number')}
            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
          >
            Ticket <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: (info) => (
          <Link
            to={`/tickets/${info.row.original.id}`}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            #{info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('subject', {
        header: 'Subject',
        cell: (info) => (
          <div className="max-w-md">
            <Link
              to={`/tickets/${info.row.original.id}`}
              className="font-medium hover:underline line-clamp-1"
            >
              {info.getValue()}
            </Link>
            <div className="text-xs text-muted-foreground line-clamp-1">
              {info.row.original.requesterName} • {info.row.original.queueName}
            </div>
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: () => (
          <button
            type="button"
            onClick={() => toggleSort('status')}
            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
          >
            Status <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('priority', {
        header: () => (
          <button
            type="button"
            onClick={() => toggleSort('priority')}
            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
          >
            Priority <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: (info) => <PriorityBadge priority={info.getValue()} />,
      }),
      columnHelper.accessor('assignedAgentName', {
        header: 'Assignee',
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {info.getValue() ?? <span className="italic">Unassigned</span>}
          </span>
        ),
      }),
      columnHelper.accessor('updatedAt', {
        header: () => (
          <button
            type="button"
            onClick={() => toggleSort('updated_at')}
            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
          >
            Updated <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: (info) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(info.getValue())}
          </span>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortOrder],
  );

  const items = ticketsQuery.data?.data ?? [];
  const meta = ticketsQuery.data?.meta;

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const hasFilters = Boolean(search || status || priority || queueId || assignedAgentId || tagId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">
            {meta
              ? `${meta.totalCount.toLocaleString()} matching tickets`
              : 'Browse, search, filter, and manage customer tickets'}
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ search: searchInput.trim() || null });
          }}
          className="flex flex-wrap gap-2"
        >
          <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[220px]">
            <Search className="absolute left-2.5 top-3.5 sm:top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search tickets"
              placeholder="Search subject or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                setSearchParams({ page: '1', pageSize: String(pageSize) });
              }}
            >
              <X className="h-4 w-4" /> Clear filters
            </Button>
          )}
        </form>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            aria-label="Filter by status"
            value={status}
            onValueChange={(val) => updateParams({ status: val || null })}
            options={[
              { value: '', label: 'All Statuses' },
              ...TICKET_STATUSES.map((s) => ({ value: s, label: formatStatusLabel(s) })),
            ]}
          />

          <Select
            aria-label="Filter by priority"
            value={priority}
            onValueChange={(val) => updateParams({ priority: val || null })}
            options={[
              { value: '', label: 'All Priorities' },
              ...TICKET_PRIORITIES.map((p) => ({ value: p, label: p.toUpperCase() })),
            ]}
          />

          <Select
            aria-label="Filter by queue"
            value={queueId}
            onValueChange={(val) => updateParams({ queueId: val || null })}
            options={[
              { value: '', label: 'All Queues' },
              ...(queuesQuery.data ?? []).map((q) => ({ value: q.id, label: q.name })),
            ]}
          />

          <Select
            aria-label="Filter by assignee"
            value={assignedAgentId}
            onValueChange={(val) => updateParams({ assignedAgentId: val || null })}
            options={[
              { value: '', label: 'All Assignees' },
              { value: 'unassigned', label: 'Unassigned' },
              ...(agentsQuery.data ?? []).map((a) => ({
                value: a.id,
                label: a.fullName,
                description: a.department,
              })),
            ]}
          />

          <Select
            aria-label="Filter by tag"
            value={tagId}
            onValueChange={(val) => updateParams({ tagId: val || null })}
            options={[
              { value: '', label: 'All Tags' },
              ...(tagsQuery.data ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        </div>
      </Card>

      {/* Data Table */}
      <Card className="overflow-hidden">
        {ticketsQuery.isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : ticketsQuery.isError ? (
          <div role="alert" className="p-6 text-center text-destructive">
            Failed to load tickets:{' '}
            {ticketsQuery.error instanceof Error ? ticketsQuery.error.message : 'Unknown error'}
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No tickets match the current search or filter criteria.
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="divide-y md:hidden">
              {items.map((ticket) => (
                <div key={ticket.id} className="p-4 space-y-2 [overflow-wrap:anywhere]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      #{ticket.ticketNumber}
                    </Link>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                  </div>
                  <Link
                    to={`/tickets/${ticket.id}`}
                    className="block text-sm font-medium hover:underline line-clamp-2"
                  >
                    {ticket.subject}
                  </Link>
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
                    <span>
                      {ticket.queueName} • {ticket.assignedAgentName ?? 'Unassigned'}
                    </span>
                    <span>{formatDateTime(ticket.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {meta && meta.totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Page <span className="font-medium text-foreground">{meta.page}</span> of{' '}
              <span className="font-medium text-foreground">
                {meta.totalPages.toLocaleString()}
              </span>{' '}
              ({meta.totalCount.toLocaleString()} total)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {queuesQuery.data && agentsQuery.data && (
        <CreateTicketDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          queues={queuesQuery.data}
          agents={agentsQuery.data}
        />
      )}
    </div>
  );
}
