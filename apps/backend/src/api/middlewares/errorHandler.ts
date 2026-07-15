import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { env } from '../../config/env.js';

/**
 * Global error handler middleware.
 *
 * Converts all errors into a consistent JSON envelope:
 * { success: false, error: { code, message, details? } }
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // ── Zod Validation Errors ────────────────────────────────
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // ── Known Application Errors ─────────────────────────────
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational error', {
        code: err.code,
        message: err.message,
        stack: err.stack,
      });
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // ── Unknown / Unexpected Errors ──────────────────────────
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    },
  });
}
