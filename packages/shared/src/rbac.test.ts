import { describe, expect, it } from 'vitest';
import { hasAnyPermission, hasPermission } from './rbac.js';

describe('RBAC permissions', () => {
  it('grants admin all administrative and ticket permissions', () => {
    expect(hasPermission('admin', 'users:manage')).toBe(true);
    expect(hasPermission('admin', 'audit:read')).toBe(true);
    expect(hasPermission('admin', 'tickets:resolve')).toBe(true);
  });

  it('allows supervisor to manage queues and view audit logs, but not manage users', () => {
    expect(hasPermission('supervisor', 'queues:manage')).toBe(true);
    expect(hasPermission('supervisor', 'audit:read')).toBe(true);
    expect(hasPermission('supervisor', 'users:manage')).toBe(false);
  });

  it('restricts support_agent from administrative mutations', () => {
    expect(hasPermission('support_agent', 'tickets:create')).toBe(true);
    expect(hasPermission('support_agent', 'tickets:resolve')).toBe(true);
    expect(hasPermission('support_agent', 'queues:manage')).toBe(false);
    expect(hasPermission('support_agent', 'audit:read')).toBe(false);
    expect(hasPermission('support_agent', 'users:manage')).toBe(false);
  });

  it('checks any permission correctly', () => {
    expect(hasAnyPermission('support_agent', ['users:manage', 'tickets:read'])).toBe(true);
    expect(hasAnyPermission('support_agent', ['users:manage', 'audit:read'])).toBe(false);
  });
});
