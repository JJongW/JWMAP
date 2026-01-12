import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';

// Zod 스키마 정의 (API 서버용)
const TagSuggestionSchema = z.object({
  name: z.string().min(1).max(30),
  type: z.enum(['mood', 'occasion', 'food', 'constraint', 'general']),
  weight: z.number().min(0).max(1).default(0.6),
});

const FeatureSuggestionSchema = z.object({
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

const LLMSuggestionsSchema = z.object({
  features: FeatureSuggestionSchema.default({}),
  tags: z.array(TagSuggestionSchema).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

type LLMSuggestions = z.infer<typeof LLMSuggestionsSchema>;

function parseLLMSuggestions(raw: string): LLMSuggestions | null {
  try {
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const objectMatch = raw.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
    }

    const json = JSON.parse(jsonStr);
    const parsed = LLMSuggestionsSchema.parse(json);

    const dedup = new Map<string, (typeof parsed.tags)[number]>();
    for (const t of parsed.tags) dedup.set(t.name, t);
    return { ...parsed, tags: [...dedup.values()].slice(0, 12) };
  } catch (e) {
    console.error('Failed to parse LLM suggestions:', e);
    return null;
  }
}

interface SuggestTagsRequest {
  placeName?: string;
  category?: string;
  experience: string;
}

const SYSTEM_PROMPT = `당신은 음식점/카페 리뷰를 분석하여 적절한 태그와 특징을 추천하는 AI입니다.

사용자의 한 줄 경험/리뷰를 분석하여 features와 tags를 추천해주세요.

## Features (boolean 값으로 응답)
- solo_ok: 혼밥/혼술이 편한 곳
- quiet: 조용한 분위기
- wait_short: 웨이팅이 없거나 짧음
- date_ok: 데이트 하기 좋은 곳
- group_ok: 단체 모임에 적합
- parking: 주차 가능
- pet_friendly: 반려동물 동반 가능
- reservation: 예약 가능/필수
- late_night: 심야 영업 (새벽까지)

## Tags (자유롭게 추천)
태그는 다음 type 중 하나로 분류:
- mood: 분위기 (예: 아늑한, 모던한, 레트로)
- occasion: 상황 (예: 혼밥, 데이트, 회식, 브런치)
- food: 음식 특징 (예: 매콤한, 담백한, 양많은)
- constraint: 제약사항 (예: 예약필수, 현금만, 주말휴무)
- general: 일반 (위에 해당 안되는 것)

weight는 0~1 사이로, 해당 태그의 확신도를 나타냅니다.

응답은 반드시 아래 JSON 형식으로만 해주세요:
{
  "features": {
    "solo_ok": true,
    "quiet": true
  },
  "tags": [
    { "name": "혼밥", "type": "occasion", "weight": 0.9 },
    { "name": "조용한 분위기", "type": "mood", "weight": 0.8 }
  ],
  "confidence": 0.82
}

주의사항:
- features는 확실한 것만 true로, 불확실하면 포함하지 마세요
- tags는 2~6개 정도로 적절히 추천
- confidence는 전체 추천의 확신도 (0~1)`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { placeName, category, experience } = req.body as SuggestTagsRequest;

  if (!experience || !experience.trim()) {
    return res.status(400).json({ error: 'experience is required' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const llm = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      maxOutputTokens: 500,
      apiKey,
    });

    const userMessage = `장소: ${placeName || '알 수 없음'}
카테고리: ${category || '알 수 없음'}
경험/리뷰: ${experience}

위 리뷰를 분석해서 features와 tags를 JSON으로 추천해주세요.`;

    const response = await llm.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ]);

    const content = typeof response.content === 'string' ? response.content : '';
    const parsed = parseLLMSuggestions(content);

    if (!parsed) {
      console.error('Failed to parse LLM response:', content);
      return res.status(200).json({
        features: {},
        tags: [],
        confidence: 0,
      });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Tag suggestion error:', error);
    return res.status(200).json({
      features: {},
      tags: [],
      confidence: 0,
    });
  }
}
