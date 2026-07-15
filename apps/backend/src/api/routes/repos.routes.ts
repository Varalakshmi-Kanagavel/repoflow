import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

import { chatRouter } from './chat.routes.js';
import { sessionsRouter } from './sessions.routes.js';

export const reposRouter = Router();

// Mount sub-routers
reposRouter.use('/repos/:repoId', chatRouter);
reposRouter.use('/repos/:repoId', sessionsRouter);

// Zod schema for query parameters on GET /repos
const listReposQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  owner: z.string().optional(),
  language: z.string().optional(),
});

// Zod schema for route parameters on GET /repos/:repoId
const repoIdParamsSchema = z.object({
  repoId: z.string().uuid('Invalid repository ID format. Must be a valid UUID.'),
});

/**
 * GET /repos
 * Lists all ingested repositories with pagination and basic filters.
 */
reposRouter.get('/repos', async (req, res, next) => {
  try {
    const parsedQuery = listReposQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.message);
    }

    const { page, limit, owner, language } = parsedQuery.data;
    const skip = (page - 1) * limit;

    // Build Prisma query filters
    const where: Record<string, unknown> = {};
    if (owner) {
      where.owner = { equals: owner, mode: 'insensitive' };
    }
    if (language) {
      where.language = { equals: language, mode: 'insensitive' };
    }

    // Run count and query in parallel to speed up response
    const [total, repos] = await Promise.all([
      prisma.repository.count({ where }),
      prisma.repository.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        repositories: repos,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching repositories list', { error });
    next(error);
  }
});

/**
 * GET /repos/:repoId
 * Retrieves detailed metadata of a specific ingested repository by its UUID.
 */
reposRouter.get('/repos/:repoId', async (req, res, next) => {
  try {
    const parsedParams = repoIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.errors.map((e) => e.message).join(', '));
    }

    const { repoId } = parsedParams.data;

    const repo = await prisma.repository.findUnique({
      where: { id: repoId },
      include: {
        _count: {
          select: {
            files: true,
            chunks: true,
          },
        },
      },
    });

    if (!repo) {
      throw new NotFoundError('Repository', repoId);
    }

    res.status(200).json({
      success: true,
      data: repo,
    });
  } catch (error) {
    logger.error(`Error fetching repository detail for ID: ${req.params['repoId']}`, { error });
    next(error);
  }
});

const ingestRepoSchema = z.object({
  githubUrl: z.string().url('Invalid GitHub URL format.'),
});

/**
 * POST /repos/ingest
 * Start the ingestion pipeline for a GitHub repository.
 */
reposRouter.post('/repos/ingest', async (req, res, next) => {
  try {
    const parsedBody = ingestRepoSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.errors.map((e) => e.message).join(', '));
    }

    // Dynamic import to avoid circular dependencies if any,
    // though static import is also fine here.
    const { ingestionService } = await import('../../modules/ingestion/ingestion.service.js');

    const repoId = await ingestionService.ingestRepository(parsedBody.data.githubUrl);

    res.status(202).json({
      success: true,
      message: 'Ingestion started',
      data: {
        repoId,
      },
    });
  } catch (error) {
    logger.error('Error starting repository ingestion', { error });
    next(error);
  }
});
