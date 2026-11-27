import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ROLES,
  type AgentDTO,
  type AuditLogDTO,
  type QueueDTO,
  type RoleName,
  type TagDTO,
  type UserSummaryDTO,
} from '@queuedesk/shared';
import { Button, Card, Input, Select } from '@/components/ui/primitives';
import { apiRequest } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { formatDateTime, formatStatusLabel } from '@/lib/utils';

type AdminTab = 'queues' | 'tags' | 'agents' | 'users' | 'audit';

export function AdminPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<AdminTab>('queues');
  const [queueName, setQueueName] = useState('');
  const [queueSlug, setQueueSlug] = useState('');
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#6366f1');

  const queuesQuery = useQuery({
    queryKey: ['admin-queues'],
    queryFn: async () => (await apiRequest<QueueDTO[]>('/admin/queues')).data,
  });

  const tagsQuery = useQuery({
    queryKey: ['admin-tags'],
    queryFn: async () => (await apiRequest<TagDTO[]>('/admin/tags')).data,
  });

  const agentsQuery = useQuery({
    queryKey: ['admin-agents'],
    queryFn: async () => (await apiRequest<AgentDTO[]>('/admin/agents')).data,
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await apiRequest<UserSummaryDTO[]>('/admin/users')).data,
    enabled: hasPermission('users:read'),
  });

  const auditQuery = useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () => (await apiRequest<AuditLogDTO[]>('/admin/audit-logs?pageSize=25')).data,
    enabled: hasPermission('audit:read'),
  });

  const createQueueMutation = useMutation({
    mutationFn: async () =>
      apiRequest('/admin/queues', {
        method: 'POST',
        body: JSON.stringify({ name: queueName, slug: queueSlug }),
      }),
    onSuccess: () => {
      setQueueName('');
      setQueueSlug('');
      void queryClient.invalidateQueries({ queryKey: ['admin-queues'] });
      toast('Queue created');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed', 'error'),
  });

  const toggleQueueMutation = useMutation({
    mutationFn: async (q: QueueDTO) =>
      apiRequest(`/admin/queues/${q.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !q.isActive }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-queues'] });
      toast('Queue updated');
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async () =>
      apiRequest('/admin/tags', {
        method: 'POST',
        body: JSON.stringify({ name: tagName, color: tagColor }),
      }),
    onSuccess: () => {
      setTagName('');
      void queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      toast('Tag created');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed', 'error'),
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/admin/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      toast('Tag deleted');
    },
  });

  const toggleAgentMutation = useMutation({
    mutationFn: async (a: AgentDTO) =>
      apiRequest(`/admin/agents/${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !a.isAvailable }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      toast('Agent availability updated');
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: RoleName }) =>
      apiRequest(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast('User role updated');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed', 'error'),
  });

  const tabs: Array<{ id: AdminTab; label: string; show: boolean }> = [
    { id: 'queues', label: 'Queues', show: hasPermission('queues:read') },
    { id: 'tags', label: 'Tags', show: hasPermission('tags:read') },
    { id: 'agents', label: 'Agents', show: hasPermission('agents:read') },
    { id: 'users', label: 'Users & Roles', show: hasPermission('users:read') },
    { id: 'audit', label: 'Audit Logs', show: hasPermission('audit:read') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Manage support queues, tags, agent capacity, user roles, and audit activity.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2" role="tablist">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <Button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              variant={activeTab === t.id ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
      </div>

      {activeTab === 'queues' && (
        <Card className="p-5 space-y-4">
          {hasPermission('queues:manage') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createQueueMutation.mutate();
              }}
              className="flex flex-wrap gap-2"
            >
              <Input
                placeholder="Queue name"
                value={queueName}
                onChange={(e) => setQueueName(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="queue-slug"
                value={queueSlug}
                onChange={(e) => setQueueSlug(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" disabled={createQueueMutation.isPending}>
                Add Queue
              </Button>
            </form>
          )}
          <div className="divide-y">
            {(queuesQuery.data ?? []).map((q) => (
              <div key={q.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{q.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {q.slug} • {q.description || 'No description'}
                  </div>
                </div>
                {hasPermission('queues:manage') && (
                  <Button variant="outline" size="sm" onClick={() => toggleQueueMutation.mutate(q)}>
                    {q.isActive ? 'Active' : 'Inactive'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'tags' && (
        <Card className="p-5 space-y-4">
          {hasPermission('tags:manage') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTagMutation.mutate();
              }}
              className="flex flex-wrap gap-2 items-center"
            >
              <Input
                placeholder="Tag name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                className="max-w-xs"
              />
              <input
                type="color"
                aria-label="Tag color"
                value={tagColor}
                onChange={(e) => setTagColor(e.target.value)}
                className="h-9 w-12 rounded border p-1"
              />
              <Button type="submit" disabled={createTagMutation.isPending}>
                Add Tag
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            {(tagsQuery.data ?? []).map((t) => (
              <div
                key={t.id}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                <span>{t.name}</span>
                {hasPermission('tags:manage') && (
                  <button
                    type="button"
                    onClick={() => deleteTagMutation.mutate(t.id)}
                    aria-label={`Delete ${t.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'agents' && (
        <Card className="p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2">Agent</th>
                <th className="pb-2">Department</th>
                <th className="pb-2">Max Capacity</th>
                <th className="pb-2 text-right">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(agentsQuery.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5 font-medium">{a.fullName}</td>
                  <td className="py-2.5 text-muted-foreground">{a.department}</td>
                  <td className="py-2.5">{a.maxCapacity}</td>
                  <td className="py-2.5 text-right">
                    {hasPermission('agents:manage') ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAgentMutation.mutate(a)}
                      >
                        {a.isAvailable ? 'Available' : 'Unavailable'}
                      </Button>
                    ) : (
                      <span>{a.isAvailable ? 'Available' : 'Unavailable'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'users' && (
        <Card className="p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(usersQuery.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 font-medium">{u.fullName}</td>
                  <td className="py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="py-2.5">
                    {hasPermission('users:manage') ? (
                      <Select
                        aria-label={`Role for ${u.fullName}`}
                        value={u.role}
                        onValueChange={(val) =>
                          updateUserRoleMutation.mutate({
                            id: u.id,
                            role: val as RoleName,
                          })
                        }
                        options={ROLES.map((r) => ({
                          value: r,
                          label: formatStatusLabel(r),
                        }))}
                        className="max-w-[180px]"
                      />
                    ) : (
                      <span>{formatStatusLabel(u.role)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card className="p-5 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Actor</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(auditQuery.data ?? []).map((log) => (
                <tr key={log.id}>
                  <td className="py-2 whitespace-nowrap text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="py-2">{log.actorEmail ?? 'system'}</td>
                  <td className="py-2 font-mono">{log.action}</td>
                  <td className="py-2">{log.entityType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
