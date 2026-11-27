import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  API_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15000),
  API_BODY_LIMIT: z.string().default('1mb'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .default('queuedesk-local-dev-secret-change-in-production-min-32-chars'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(10).default(300),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(5).default(30),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PG_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
  PG_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  PG_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(500).default(5000),
  PG_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(500).default(15000),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(overrides?: Record<string, string | undefined>): EnvConfig {
  const source = overrides ? { ...process.env, ...overrides } : process.env;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }
  return parsed.data;
}

export const env = loadEnv();
