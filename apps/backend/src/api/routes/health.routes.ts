import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { logger } from '../../shared/logger.js';

export const healthRouter = Router();

/**
 * GET /health
 * Returns service health including database connectivity.
 */
healthRouter.get('/health', async (_req, res) => {
  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? '0.1.0',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'connected';
  } catch (error) {
    health.database = 'disconnected';
    health.status = 'degraded';
    logger.warn('Health check: database unreachable', { error });
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json({ success: true, data: health });
});
