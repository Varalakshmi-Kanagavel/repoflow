import winston from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

/**
 * Development format: colored, human-readable.
 * Production format: structured JSON for log aggregation.
 */
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}${stackStr}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'repoflow-api' },
  transports: [new winston.transports.Console()],
});
