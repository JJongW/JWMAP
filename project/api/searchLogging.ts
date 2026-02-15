import type { EnhancedLLMQuery } from './searchTypes';

type SearchLogsUpdater = {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<unknown>;
    };
  };
};

type GetSupabaseClient = () => SearchLogsUpdater;

export async function updateSearchLogParsed(
  getSupabase: GetSupabaseClient,
  searchLogId: string,
  enhanced: EnhancedLLMQuery,
  rawParsed: Record<string, unknown>,
  llmMs: number,
  confidence: number | null
): Promise<void> {
  try {
    const updatePayload: Record<string, unknown> = {
      parsed: rawParsed,
      llm_ms: llmMs,
      parsed_intent: enhanced.intent,
      parsed_category_main: enhanced.slots.category_main ?? null,
      parsed_category_sub: enhanced.slots.category_sub ?? null,
      parsed_tags: enhanced.slots.keywords?.length ? enhanced.slots.keywords : null,
      parsed_confidence: confidence,
    };

    await getSupabase().from('search_logs').update(updatePayload).eq('id', searchLogId);
    console.log(`[search_logs] UPDATE parsed: ${searchLogId}`);
  } catch (err) {
    console.error('[search_logs] UPDATE parsed error:', err);
  }
}

export async function updateSearchLogResult(
  getSupabase: GetSupabaseClient,
  searchLogId: string,
  resultCount: number,
  dbMs: number,
  totalMs: number,
  fallbackUsed: boolean,
  fallbackStep: number
): Promise<void> {
  try {
    await getSupabase().from('search_logs').update({
      result_count: resultCount,
      fallback_used: fallbackUsed,
      fallback_step: fallbackStep,
      db_ms: dbMs,
      total_ms: totalMs,
    }).eq('id', searchLogId);

    console.log(`[search_logs] UPDATE result: ${searchLogId}, count=${resultCount}, fallback=${fallbackUsed}`);
  } catch (err) {
    console.error('[search_logs] UPDATE result error:', err);
  }
}
