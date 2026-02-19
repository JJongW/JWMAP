import { createClient } from '@supabase/supabase-js';

function decodeJwtPayload(token: string): { role?: unknown; ref?: unknown } | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`;
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      role?: unknown;
      ref?: unknown;
    };
    return payload;
  } catch {
    return null;
  }
}

function getProjectRefFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }

  const payload = decodeJwtPayload(key);
  if (!payload) {
    throw new Error('Invalid SUPABASE_SERVICE_KEY format (not a valid JWT token).');
  }

  if (payload.role !== 'service_role') {
    throw new Error(`Invalid SUPABASE key role: ${payload.role}. Expected "service_role" key, not anon/other key.`);
  }

  const keyProjectRef = typeof payload.ref === 'string' ? payload.ref : null;
  const urlProjectRef = getProjectRefFromUrl(url);
  if (keyProjectRef && urlProjectRef && keyProjectRef !== urlProjectRef) {
    throw new Error(`SUPABASE key project mismatch: key is for "${keyProjectRef}", but NEXT_PUBLIC_SUPABASE_URL points to "${urlProjectRef}".`);
  }

  return createClient(url, key);
}
