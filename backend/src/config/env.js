import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from local environment file
dotenv.config();

// Define strict validation schema for server environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  BCRYPT_ROUNDS: z.coerce.number().int().default(12),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_EXPIRE_IN: z.string().default('1h'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment configuration validation failed:', parsedEnv.error.format());
  process.exit(1);
}

/**
 * Validated read-only environment configuration state.
 * Prevents ad-hoc raw usage of process.env throughout modules.
 * 
 * @type {Readonly<z.infer<typeof envSchema>>}
 */
export const env = Object.freeze(parsedEnv.data);
export default env;
