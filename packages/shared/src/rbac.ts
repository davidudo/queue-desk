import { ROLE_PERMISSIONS, type Permission, type RoleName } from './constants.js';

export function hasPermission(role: RoleName, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.includes(permission) : false;
}

export function hasAnyPermission(role: RoleName, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
