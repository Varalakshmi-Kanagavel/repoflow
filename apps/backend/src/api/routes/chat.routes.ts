import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ragService } from '../../modules/rag/rag.service.js';
import { ValidationError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

export const chatRouter = Router({ mergeParams: true }); // Important for accessing :repoId from parent router

const chatBodySchema = z.object({
  question: z.string().min(1, 'Question cannot be empty.'),
  stream: z.boolean().optional().default(false),
  sessionId: z.string().uuid().optional(), // Prepared for Sprint 6
});

/**
 * POST /repos/:repoId/chat
 * Answers a question about the repository using RAG.
 */
chatRouter.post('/chat', async (req, res, next) => {
  try {
    const params = req.params as Record<string, string>;
    const repoId = params['repoId'];
    if (!repoId) {
      throw new ValidationError('repoId parameter is required.');
    }

    const parsedBody = chatBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.errors.map((e) => e.message).join(', '));
    }

    const { question, stream } = parsedBody.data;
    let { sessionId } = parsedBody.data;

    // Ensure session exists or create one
    if (!sessionId) {
      const newSession = await prisma.chatSession.create({
        data: {
          repoId,
          title: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
        },
      });
      sessionId = newSession.id;
    } else {
      const existing = await prisma.chatSession.findUnique({ where: { id: sessionId } });
      if (!existing) {
        throw new ValidationError('Session ID does not exist.');
      }
    }

    const ragResult = await ragService.queryRepository(repoId, question, stream);

    if (stream) {
      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send citations and confidence first
      res.write(
        `data: ${JSON.stringify({
          type: 'metadata',
          citations: ragResult.citations,
          confidenceScore: ragResult.confidenceScore,
        })}\n\n`,
      );

      let fullAnswer = '';

      // Stream chunks from Groq
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of ragResult.stream as any) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullAnswer += content;
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: content })}\n\n`);
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();

      // Persist to DB asynchronously after response is sent
      Promise.all([
        prisma.chatMessage.create({
          data: { sessionId, role: 'USER', content: question },
        }),
        prisma.chatMessage.create({
          data: {
            sessionId,
            role: 'ASSISTANT',
            content: fullAnswer,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            citations: ragResult.citations as any, // json type
            confidenceScore:
              ragResult.confidenceScore === 'High'
                ? 0.9
                : ragResult.confidenceScore === 'Medium'
                  ? 0.6
                  : 0.3,
          },
        }),
      ]).catch((err) => logger.error('Failed to persist chat messages', { err }));
    } else {
      // Normal JSON response
      res.status(200).json({
        success: true,
        data: {
          answer: ragResult.answer,
          citations: ragResult.citations,
          confidenceScore: ragResult.confidenceScore,
          sessionId,
        },
      });

      // Persist to DB asynchronously
      Promise.all([
        prisma.chatMessage.create({
          data: { sessionId, role: 'USER', content: question },
        }),
        prisma.chatMessage.create({
          data: {
            sessionId,
            role: 'ASSISTANT',
            content: ragResult.answer || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            citations: ragResult.citations as any, // json type
            confidenceScore:
              ragResult.confidenceScore === 'High'
                ? 0.9
                : ragResult.confidenceScore === 'Medium'
                  ? 0.6
                  : 0.3,
          },
        }),
      ]).catch((err) => logger.error('Failed to persist chat messages', { err }));
    }
  } catch (error) {
    logger.error('Error in chat endpoint', { error });
    next(error);
  }
});
