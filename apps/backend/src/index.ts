import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';
import { errorHandler } from './api/middlewares/errorHandler.js';
import { requestLogger } from './api/middlewares/requestLogger.js';
import { rateLimiter } from './api/middlewares/rateLimiter.js';
import { healthRouter } from './api/routes/health.routes.js';
import { reposRouter } from './api/routes/repos.routes.js';

/**
 * RepoFlow API Server
 *
 * Sprint 1: Foundation + Repository Endpoints.
 * Future sprints add: Ingestion, Chunking, Pinecone, RAG, Chat.
 */
const app = express();

// ── Security & Throttling ─────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(rateLimiter());

// ── Parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────
app.use('/v1', healthRouter);
app.use('/v1', reposRouter);

// ── Error Handling ────────────────────────────────────────────
app.use(errorHandler);

// ── Server Startup ────────────────────────────────────────────
const server = app.listen(env.PORT, () => {
  logger.info(`🚀 RepoFlow API running on port ${env.PORT}`, {
    env: env.NODE_ENV,
    port: env.PORT,
  });
});

// ── Graceful Shutdown ─────────────────────────────────────────
const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
