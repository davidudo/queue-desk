import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  hasPermission as checkRolePermission,
  type AuthUser,
  type LoginInput,
  type LoginResponse,
  type Permission,
} from '@queuedesk/shared';
import { apiRequest, getAuthToken, setAuthToken } from './api-client';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadMe() {
      if (!getAuthToken()) {
        if (active) setIsLoading(false);
        return;
      }
      try {
        const res = await apiRequest<{ user: AuthUser }>('/auth/me');
        if (active) setUser(res.data.user);
      } catch {
        setAuthToken(null);
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadMe();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setAuthToken(res.data.token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!user) return false;
      return checkRolePermission(user.role, permission);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
