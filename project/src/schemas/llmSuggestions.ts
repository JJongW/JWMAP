import { z } from "zod";

export const TagSuggestionSchema = z.object({
  name: z.string().min(1).max(30),
  type: z.enum(["mood", "occasion", "food", "constraint", "general"]),
  weight: z.number().min(0).max(1).default(0.6),
});

export const FeatureSuggestionSchema = z.object({
  solo_ok: z.boolean().optional(),
  quiet: z.boolean().optional(),
  wait_short: z.boolean().optional(),
  date_ok: z.boolean().optional(),
  group_ok: z.boolean().optional(),
  parking: z.boolean().optional(),
  pet_friendly: z.boolean().optional(),
  reservation: z.boolean().optional(),
  late_night: z.boolean().optional(),
});

export const LLMSuggestionsSchema = z.object({
  features: FeatureSuggestionSchema.default({}),
  tags: z.array(TagSuggestionSchema).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type TagSuggestion = z.infer<typeof TagSuggestionSchema>;
export type FeatureSuggestion = z.infer<typeof FeatureSuggestionSchema>;
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

    // 중복 태그 제거 및 최대 12개로 제한
    const dedup = new Map<string, (typeof parsed.tags)[number]>();
    for (const t of parsed.tags) dedup.set(t.name, t);
    return { ...parsed, tags: [...dedup.values()].slice(0, 12) };
  } catch (e) {
    console.error('Failed to parse LLM suggestions:', e);
    return null;
  }
}

// Feature 키를 한글 라벨로 변환
export const featureLabels: Record<keyof FeatureSuggestion, string> = {
  solo_ok: '혼밥 가능',
  quiet: '조용한 분위기',
  wait_short: '웨이팅 짧음',
  date_ok: '데이트 추천',
  group_ok: '단체석 있음',
  parking: '주차 가능',
  pet_friendly: '반려동물 동반',
  reservation: '예약 가능',
  late_night: '심야 영업',
};

// Tag 타입을 한글 라벨로 변환
export const tagTypeLabels: Record<TagSuggestion['type'], string> = {
  mood: '분위기',
  occasion: '상황',
  food: '음식',
  constraint: '제약',
  general: '일반',
};
