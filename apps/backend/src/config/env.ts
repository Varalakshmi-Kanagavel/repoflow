import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment variable schema.
 *
 * Sprint 0: Only DATABASE_URL, PORT, NODE_ENV, CORS_ORIGIN, LOG_LEVEL are required.
 * Future sprints will add GITHUB_TOKEN, OPENAI_API_KEY, PINECONE_API_KEY, etc.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('debug'),

  // ── Future Sprint Variables (optional in Sprint 0) ──────────
  GITHUB_TOKEN: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(['sentence-transformers']).default('sentence-transformers'),
  EMBEDDING_MODEL: z.string().default('all-mpnet-base-v2'),
  OPENAI_API_KEY: z.string().optional(), // No longer strictly required if not using OpenAI
  PINECONE_API_KEY: z.string().min(1, 'PINECONE_API_KEY is required'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  PINECONE_INDEX_NAME: z.string().default('repoflow-chunks'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 * Fails fast at startup with descriptive error messages.
 */
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error('\n❌ Invalid environment variables:');
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  return result.data;
}

/** Validated environment variables — import this everywhere */
export const env = validateEnv();
