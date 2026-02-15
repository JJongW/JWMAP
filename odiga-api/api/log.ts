import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../lib/rateLimit';
import {
  setCORS,
  handlePreflight,
  validateMethod,
  sanitizeQuery,
  safeError,
} from '../lib/security';
import { getSupabase } from '../lib/places';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  if (handlePreflight(req, res)) return;
  if (!validateMethod(req, res, 'POST')) return;

  const allowed = await checkRateLimit(req, res, 'log');
  if (!allowed) return;

  const {
    raw_query,
    region,
    vibe,
    people_count,
    mode,
    season,
    activity_type,
    response_type,
    selected_course,
    selected_place_id,
    selected_place_name,
    regenerate_count,
    parse_error_fields,
    user_feedbacks,
  } = req.body || {};

  const query = sanitizeQuery(raw_query);
  if (!query) {
    return safeError(res, 400, 'Missing or invalid "raw_query"');
  }

  try {
    const entry = {
      raw_query: query,
      region: typeof region === 'string' ? region : null,
      vibe: Array.isArray(vibe) ? vibe.filter((v: unknown) => typeof v === 'string') : [],
      people_count: typeof people_count === 'number' ? people_count : null,
      mode: typeof mode === 'string' ? mode : null,
      season: typeof season === 'string' ? season : null,
      activity_type: typeof activity_type === 'string' ? activity_type : null,
      response_type: typeof response_type === 'string' ? response_type : 'single',
      selected_course: selected_course || null,
      selected_place_id: typeof selected_place_id === 'string' ? selected_place_id : null,
      selected_place_name: typeof selected_place_name === 'string' ? selected_place_name : null,
      regenerate_count: typeof regenerate_count === 'number' ? regenerate_count : 0,
      parse_error_fields: Array.isArray(parse_error_fields) ? parse_error_fields : [],
      user_feedbacks: Array.isArray(user_feedbacks)
        ? user_feedbacks.filter((f: unknown) => typeof f === 'string')
        : [],
      created_at: new Date().toISOString(),
    };

    const { error } = await getSupabase().from('odiga_search_logs').insert(entry);

    if (error) {
      console.error('[odiga/log] Supabase error:', error.message);
      return safeError(res, 500, 'Failed to log search');
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[odiga/log] Error:', error instanceof Error ? error.message : error);
    return safeError(res, 500, 'Internal server error');
  }
}
