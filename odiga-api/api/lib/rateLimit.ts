import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration string (e.g. "1 m", "1 d") */
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`;
  /** Prefix for the rate limit key */
  prefix: string;
}

const ENDPOINT_CONFIGS: Record<string, RateLimitConfig[]> = {
  recommend: [
    { limit: 5, window: '1 m', prefix: 'odiga:recommend:min' },
    { limit: 100, window: '1 d', prefix: 'odiga:recommend:day' },
  ],
  log: [
    { limit: 10, window: '1 m', prefix: 'odiga:log:min' },
  ],
  stats: [
    { limit: 3, window: '1 m', prefix: 'odiga:stats:min' },
  ],
  'save-course': [
    { limit: 5, window: '1 m', prefix: 'odiga:save:min' },
  ],
};

function getClientIP(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Check rate limit for the given endpoint.
 * Returns true if allowed, false if rate-limited (also sends 429 response).
 * If Redis is not configured, always allows (graceful degradation).
 */
export async function checkRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  endpoint: string,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // graceful degradation

  const configs = ENDPOINT_CONFIGS[endpoint];
  if (!configs) return true;

  const ip = getClientIP(req);

  for (const config of configs) {
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, config.window),
      prefix: config.prefix,
    });

    const { success, limit, remaining, reset } = await limiter.limit(ip);

    if (!success) {
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(reset));
      res.setHeader('Retry-After', String(Math.ceil((reset - Date.now()) / 1000)));
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      });
      return false;
    }

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
  }

  return true;
}
