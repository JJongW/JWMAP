import { z } from "zod";

export const TagSuggestionSchema = z.object({
  name: z.string().min(1).max(30),
  type: z.enum(["theme", "season", "occasion", "vibe", "food", "place", "constraint", "general"]),
  weight: z.number().min(0).max(1).default(0.6),
});

export const LLMSuggestionsSchema = z.object({
  tags: z.array(TagSuggestionSchema).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type TagSuggestion = z.infer<typeof TagSuggestionSchema>;
export type LLMSuggestions = z.infer<typeof LLMSuggestionsSchema>;

export function parseLLMSuggestions(raw: string): LLMSuggestions | null {
  try {
    // JSON 블록 추출 (마크다운 코드블록 처리)
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // 순수 JSON 객체 추출
      const objectMatch = raw.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
    }

    const json = JSON.parse(jsonStr);
    const parsed = LLMSuggestionsSchema.parse(json);

    // 중복 태그 제거 및 최대 15개로 제한
    const dedup = new Map<string, (typeof parsed.tags)[number]>();
    for (const t of parsed.tags) dedup.set(t.name, t);
    return { ...parsed, tags: [...dedup.values()].slice(0, 15) };
  } catch (e) {
    console.error('Failed to parse LLM suggestions:', e);
    return null;
  }
}

// Tag 타입을 한글 라벨로 변환
export const tagTypeLabels: Record<TagSuggestion['type'], string> = {
  theme: '테마',
  season: '계절',
  occasion: '상황',
  vibe: '분위기',
  food: '음식',
  place: '장소',
  constraint: '제약',
  general: '일반',
};
