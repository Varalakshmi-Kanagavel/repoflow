import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * Prisma Client Singleton.
 *
 * In development, hot-reloading can create multiple PrismaClient instances.
 * This module ensures only one instance exists by caching it on `globalThis`.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    datasourceUrl: env.DATABASE_URL,
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
