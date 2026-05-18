import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16).default('dev-only-change-this-secret'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-only-refresh-secret-change-me'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_SECRET_SSO: z.string().min(16).default('dev-only-sso-secret-change-me'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5174'),
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_SIZE: z.coerce.number().default(52428800), // 50MB
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (
  parsed.data.NODE_ENV === 'production' &&
  (parsed.data.JWT_SECRET === 'dev-only-change-this-secret' ||
    parsed.data.JWT_REFRESH_SECRET === 'dev-only-refresh-secret-change-me' ||
    parsed.data.JWT_SECRET_SSO === 'dev-only-sso-secret-change-me')
) {
  console.error('JWT secrets must be set to strong values in production.');
  process.exit(1);
}

export const env = parsed.data;
