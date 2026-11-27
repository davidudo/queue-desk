import type { ApiErrorResponse, ApiSuccessResponse } from '@queuedesk/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let memoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryToken = token;
  if (token) {
    sessionStorage.setItem('qd_token', token);
  } else {
    sessionStorage.removeItem('qd_token');
  }
}

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  const stored = sessionStorage.getItem('qd_token');
  memoryToken = stored;
  return stored;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiSuccessResponse<T>> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = (await response.json().catch(() => null)) as
    ApiSuccessResponse<T> | ApiErrorResponse | null;

  if (!response.ok) {
    const errBody = json as ApiErrorResponse | null;
    throw new ApiClientError(
      response.status,
      errBody?.error?.code ?? 'REQUEST_FAILED',
      errBody?.error?.message ?? `Request failed with status ${response.status}`,
      errBody?.error?.details,
    );
  }

  return json as ApiSuccessResponse<T>;
}
