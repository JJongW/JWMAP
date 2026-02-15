import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Set CORS headers for all responses */
export function setCORS(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/** Handle OPTIONS preflight */
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/** Validate that req.method matches expected */
export function validateMethod(
  req: VercelRequest,
  res: VercelResponse,
  expected: string,
): boolean {
  if (req.method !== expected) {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

/** Sanitize and validate a query string (max 500 chars) */
export function sanitizeQuery(query: unknown): string | null {
  if (typeof query !== 'string') return null;
  const trimmed = query.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0 || trimmed.length > 500) return null;
  return trimmed;
}

/** Safe positive integer validation */
export function toPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

/** Whitelist validation for mode strings */
const VALID_MODES = ['solo', 'date', 'group', 'party'];
export function validateMode(mode: unknown): string | null {
  if (typeof mode === 'string' && VALID_MODES.includes(mode)) return mode;
  return null;
}

/** Whitelist validation for response_type */
const VALID_RESPONSE_TYPES = ['single', 'course'];
export function validateResponseType(type: unknown): 'single' | 'course' | null {
  if (typeof type === 'string' && VALID_RESPONSE_TYPES.includes(type)) {
    return type as 'single' | 'course';
  }
  return null;
}

/** Return a safe error response (no internal details) */
export function safeError(res: VercelResponse, status: number, message: string): void {
  res.status(status).json({ error: message });
}
