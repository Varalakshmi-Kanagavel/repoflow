import type { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../../shared/errors.js';

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
};

const store = new Map<string, number[]>();

/**
 * Clean up expired timestamps from the memory store to prevent memory leaks.
 */
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, timestamps] of store.entries()) {
      const validTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < defaultConfig.windowMs,
      );
      if (validTimestamps.length === 0) {
        store.delete(ip);
      } else {
        store.set(ip, validTimestamps);
      }
    }
  },
  5 * 60 * 1000,
); // run cleanup every 5 minutes

/**
 * Pure TypeScript sliding-window rate limiting middleware.
 * Keeps dependencies minimal and execution fast for the MVP.
 */
export function rateLimiter(config: Partial<RateLimitConfig> = {}) {
  const options = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Treat localhost/testing IPs gracefully if needed
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    let timestamps = store.get(ip) ?? [];

    // Filter out timestamps outside the current window
    timestamps = timestamps.filter((timestamp) => now - timestamp < options.windowMs);

    if (timestamps.length >= options.max) {
      const oldestTimestamp = timestamps[0] ?? now;
      const resetTime = oldestTimestamp + options.windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(options.max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

      next(new RateLimitError(`Too many requests. Please try again in ${retryAfter} seconds.`));
      return;
    }

    timestamps.push(now);
    store.set(ip, timestamps);

    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(options.max - timestamps.length));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + options.windowMs) / 1000)));

    next();
  };
}
