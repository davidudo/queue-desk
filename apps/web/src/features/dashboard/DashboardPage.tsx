import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { DashboardSummaryDTO } from '@queuedesk/shared';
import { Card, PriorityBadge, Skeleton, StatusBadge } from '@/components/ui/primitives';
import { apiRequest } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await apiRequest<DashboardSummaryDTO>('/dashboard/summary');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Support Operations</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-6 text-destructive">
        Failed to load dashboard: {error instanceof Error ? error.message : 'Unknown error'}
      </Card>
    );
  }

  const kpis = [
    { label: 'Total Tickets', value: data.totals.all.toLocaleString() },
    {
      label: 'Open & In Progress',
      value: (data.totals.open + data.totals.inProgress).toLocaleString(),
    },
    { label: 'Pending Customer', value: data.totals.pending.toLocaleString() },
    {
      label: 'Resolved & Closed',
      value: (data.totals.resolved + data.totals.closed).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Operations</h1>
          <p className="text-sm text-muted-foreground">
            FlowOps customer issues, support queues, and agent workload.
          </p>
        </div>
        <Link to="/tickets" className="text-sm font-medium text-primary hover:underline">
          Browse all tickets →
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <div className="text-xs font-medium text-muted-foreground">{kpi.label}</div>
            <div className="mt-2 text-2xl font-bold">{kpi.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tickets by Queue */}
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-semibold">Tickets by Support Queue</h2>
          <div className="space-y-3">
            {data.byQueue.map((q) => {
              const pct = data.totals.all > 0 ? Math.round((q.count / data.totals.all) * 100) : 0;
              return (
                <div key={q.queueId} className="space-y-1">
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium">{q.queueName}</span>
                    <span className="text-muted-foreground">
                      {q.count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Tickets by Priority */}
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-semibold">Tickets by Priority</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.byPriority.map((p) => (
              <div
                key={p.priority}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <PriorityBadge priority={p.priority} />
                <span className="text-lg font-semibold">{p.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recently Updated Tickets */}
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-semibold">Recently Updated Tickets</h2>
          <div className="divide-y">
            {data.recentlyUpdated.map((t) => (
              <div key={t.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/tickets/${t.id}`}
                    className="block text-sm font-medium hover:underline whitespace-normal [overflow-wrap:anywhere]"
                  >
                    #{t.ticketNumber} {t.subject}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {t.queueName} • Updated {formatDateTime(t.updatedAt)}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        </Card>

        {/* Agent Workload */}
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-semibold">Agent Workload Overview</h2>
          <div className="overflow-x-auto">
            <table className="min-w-[360px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Department</th>
                  <th className="pb-2 font-medium text-right">Active / Cap</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.agentWorkload.map((a) => (
                  <tr key={a.agentId}>
                    <td className="py-2 font-medium">{a.fullName}</td>
                    <td className="py-2 text-muted-foreground">{a.department}</td>
                    <td className="py-2 text-right font-mono text-xs">
                      {a.activeTickets} / {a.maxCapacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
