import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

export const sessionsRouter = Router({ mergeParams: true });

/**
 * GET /repos/:repoId/sessions
 * Returns all chat sessions for a given repository.
 */
sessionsRouter.get('/sessions', async (req, res, next) => {
  try {
    const params = req.params as Record<string, string>;
    const repoId = params['repoId'];

    const sessions = await prisma.chatSession.findMany({
      where: { repoId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    logger.error('Error fetching sessions', { error });
    next(error);
  }
});

/**
 * GET /repos/:repoId/sessions/:sessionId/messages
 * Returns all messages in a specific chat session.
 */
sessionsRouter.get('/sessions/:sessionId/messages', async (req, res, next) => {
  try {
    const params = req.params as Record<string, string>;
    const sessionId = params['sessionId'];

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('ChatSession', sessionId);
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    logger.error('Error fetching session messages', { error });
    next(error);
  }
});
