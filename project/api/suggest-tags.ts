import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import {
  sanitizeTagNames,
  sanitizeTagSuggestions,
} from './tagIntelligence';

// Zod 스키마 정의 (API 서버용)
const TagSuggestionSchema = z.object({
  name: z.string().min(1).max(30),
  type: z.enum(['theme', 'season', 'occasion', 'vibe', 'food', 'place', 'constraint', 'general']),
  weight: z.number().min(0).max(1).default(0.6),
});

const LLMSuggestionsSchema = z.object({
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
    const normalizedTags = sanitizeTagSuggestions(parsed.tags, { max: 15 });
    return { ...parsed, tags: normalizedTags };
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

const SYSTEM_PROMPT = `당신은 장소 리뷰를 분석해 검색 친화적인 태그를 추출하는 AI입니다.

## Tags (2~8개 추천)
태그는 다음 type 중 하나로 분류:
- theme: 테마 (예: 벚꽃, 단풍, 크리스마스, 전시데이트)
- season: 계절/날씨 (예: 봄, 여름밤, 비오는날)
- occasion: 상황 (예: 혼밥, 데이트, 회식, 브런치)
- vibe: 분위기 (예: 아늑한, 모던한, 조용한 분위기)
- food: 음식 태그 (예: 매콤한, 담백한, 브런치)
- place: 장소 태그 (예: 포토스팟, 산책, 야경, 실내)
- constraint: 제약사항 (예: 예약 가능, 웨이팅 적음, 주차 가능)
- general: 일반 (위에 해당 안되는 것)

weight는 0~1 사이로, 해당 태그의 확신도를 나타냅니다.

응답은 반드시 아래 JSON 형식으로만 해주세요:
{
  "tags": [
    { "name": "벚꽃", "type": "theme", "weight": 0.9 },
    { "name": "데이트", "type": "occasion", "weight": 0.85 },
    { "name": "포토스팟", "type": "place", "weight": 0.8 }
  ],
  "confidence": 0.82
}

주의사항:
- 장소명 자체를 태그로 넣지 마세요
- 카테고리명만 단독으로 반복하지 마세요
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

위 리뷰를 분석해서 검색용 태그(tags)를 JSON으로 추천해주세요.`;

    const response = await llm.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ]);

    const content = typeof response.content === 'string' ? response.content : '';
    const parsed = parseLLMSuggestions(content);

    if (!parsed) {
      console.error('Failed to parse LLM response:', content);
      return res.status(200).json({
        tags: [],
        confidence: 0,
      });
    }

    // 검증 단계: 최종 태그를 정규화한다.
    const mergedNames = sanitizeTagNames(
      [...parsed.tags.map((tag) => tag.name)],
      { max: 15, banned: [placeName || '', category || ''] }
    );
    const mergedWeights = new Map(parsed.tags.map((tag) => [tag.name, tag.weight]));
    const verifiedTags = mergedNames.map((name) => ({
      name,
      type: parsed.tags.find((tag) => tag.name === name)?.type || 'general',
      weight: mergedWeights.get(name) ?? 0.6,
    }));

    return res.status(200).json({
      ...parsed,
      tags: verifiedTags,
    });
  } catch (error) {
    console.error('Tag suggestion error:', error);
    return res.status(200).json({
      tags: [],
      confidence: 0,
    });
  }
}
