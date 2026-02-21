import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { getPlaceActivityBucket, type Place } from './places';
import type { ScoredPlace } from './scoring';
import type { ParsedIntent } from './intent';
import type { Course } from './courseBuilder';

export type NarrativeConfidence = 'high' | 'medium' | 'low';

export interface CourseStepNarrative {
  name: string;
  place_id: string;
  region: string;
  vibe_hint: string;
}

export interface BrandedPlace {
  rank: number;
  place: Place;
  recommendation_reason: string;
  confidence: NarrativeConfidence;
}

export interface BrandedCourse {
  id: number;
  route_summary: string;
  totalDistance: number;
  difficulty: Course['difficulty'];
  mode: string;
  vibes: string[];
  totalScore: number;
  places: CourseStepNarrative[];
  recommendation_reason: string;
  confidence: NarrativeConfidence;
  course_story: string;
  mood_flow: string[];
  ideal_time: string;
  curation_text?: string;
}

export interface BrandedRecommendResponse {
  curated_summary: string;
  confidence: NarrativeConfidence;
  places: BrandedPlace[];
  courses: BrandedCourse[];
}

interface LlmResponse {
  curated_summary?: unknown;
  confidence?: unknown;
  places?: Array<{
    id?: unknown;
    recommendation_reason?: unknown;
    confidence?: unknown;
  }>;
  courses?: Array<{
    id?: unknown;
    recommendation_reason?: unknown;
    confidence?: unknown;
    course_story?: unknown;
    mood_flow?: unknown;
    ideal_time?: unknown;
  }>;
}

const SINGLE_RESULT_COUNT = 5;
const COURSE_RESULT_COUNT = 4;

function pickTopPlaces(places: ScoredPlace[]): ScoredPlace[] {
  return places.slice(0, SINGLE_RESULT_COUNT);
}

function pickTopCourses(courses: Course[]): Course[] {
  return courses.slice(0, COURSE_RESULT_COUNT);
}

function normalizeConfidence(raw: unknown): NarrativeConfidence {
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'medium';
}

function deriveConfidenceFromScore(value: number, alternatives: number = 1): NarrativeConfidence {
  const score = Math.max(0, Math.min(1, value));
  if (score >= 0.83 && alternatives >= 1) return 'high';
  if (score >= 0.63) return 'medium';
  return 'low';
}

function summarizeVibes(place: Place, intent: ParsedIntent): string[] {
  const vibes = [...intent.vibe];
  if (place.tags && place.tags.length > 0) {
    const tags = place.tags.filter((tag) => tag.length > 0);
    vibes.push(...tags.slice(0, 2));
  }
  return [...new Set(vibes)].slice(0, 2);
}

function buildFallbackPlaceReasons(place: Place, intent: ParsedIntent, rank: number): string {
  const bucket = getPlaceActivityBucket(place);
  const vibes = summarizeVibes(place, intent);
  const vibeText = vibes.length > 0 ? `(${vibes.join(', ')})` : '';

  if (rank === 1) {
    return `${place.name}은(는) ${bucket} 카테고리와 의도 vibe가 가장 잘 맞고 거리/평점 조건을 함께 만족하는 후보입니다. ${vibeText}`;
  }
  return `${place.name}은(는) ${bucket} 성향 + ${intent.activity_type || '요청 활동'} 호환성이 높아 보이는 후보입니다. ${vibeText}`;
}

function buildFallbackCourseReasons(course: Course): string {
  const vibeSummary = course.vibes.length > 0 ? course.vibes[0] : '데이트';
  return `${course.steps.length}개 스텝으로 ${vibeSummary} 감성이 이어지는 동선 구성입니다.`;
}

function toCourseNarrativeSteps(course: Course): CourseStepNarrative[] {
  return course.steps.map((step) => ({
    name: step.place.name,
    place_id: step.place.id,
    region: step.place.region || '',
    vibe_hint: step.label || '',
  }));
}

function buildRouteSummary(course: Course): string {
  if (course.steps.length === 0) return '경로 정보 없음';
  return course.steps.map((step) => step.place.name).join(' → ');
}

function toNarrativeMinutes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '1~1.5시간';
  const minutes = Math.round((value / 1000) * 2);
  if (minutes <= 45) return '약 45분';
  if (minutes <= 75) return '약 1시간 15분';
  if (minutes <= 120) return '약 2시간';
  return '2시간 30분';
}

function buildFallbackCoursePayload(course: Course, index: number): BrandedCourse {
  const moodFlow = course.steps.map((step) => step.label || '이동').filter((v) => v.length > 0);
  const vibeHint = moodFlow.length > 0 ? moodFlow.join(' → ') : '차분한 동선';

  return {
    id: course.id || index + 1,
    route_summary: buildRouteSummary(course),
    totalDistance: course.totalDistance,
    difficulty: course.difficulty,
    mode: course.mode,
    vibes: course.vibes,
    totalScore: course.totalScore,
    places: toCourseNarrativeSteps(course),
    recommendation_reason: buildFallbackCourseReasons(course),
    confidence: deriveConfidenceFromScore(course.totalScore, course.steps.length || 1),
    course_story: `${course.steps.map((step) => step.place.name).join('으로 시작해 ') } ${vibeHint}로 이어지는 ${course.steps.length}스테이션 코스입니다.`,
    mood_flow: moodFlow,
    ideal_time: toNarrativeMinutes(course.totalDistance),
  };
}

function buildFallbackResponse(topPlaces: ScoredPlace[], topCourses: Course[]): BrandedRecommendResponse {
  const places = topPlaces.map((place, index) => ({
    rank: index + 1,
    place,
    recommendation_reason: buildFallbackPlaceReasons(place, { vibe: [], activity_type: null } as ParsedIntent, index + 1),
    confidence: deriveConfidenceFromScore(place.score, topPlaces.length),
  }));

  const courses = topCourses.map((course, index) => ({
    ...buildFallbackCoursePayload(course, index),
  }));

  return {
    curated_summary: '요청 의도와 점수 기반 후보를 점검해 오늘 바로 실행 가능한 추천입니다.',
    confidence: places.length > 0 ? deriveConfidenceFromScore(places[0].confidence === 'high' ? 0.9 : places[0].confidence === 'medium' ? 0.68 : 0.42, places.length) : 'low',
    places,
    courses,
  };
}

function getLLM(): ChatGoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');
  return new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    maxOutputTokens: 600,
    apiKey,
  });
}

function buildPrompt(topPlaces: ScoredPlace[], topCourses: Course[], intent: ParsedIntent): string {
  const placeInputs = topPlaces.map((place, index) => ({
    rank: index + 1,
    id: place.id,
    name: place.name,
    category: `${place.category_main || ''} ${place.category_sub || ''}`.trim(),
    vibe: place.memo || '',
    tags: place.tags || [],
    score: Number(place.score.toFixed(2)),
    activity_type: intent.activity_type,
    region: place.region,
    sub_region: place.sub_region || '',
  }));

  const courseInputs = topCourses.map((course) => ({
    id: course.id,
    totalDistance: course.totalDistance,
    difficulty: course.difficulty,
    steps: course.steps.map((step) => ({
      index: step.label,
      name: step.place.name,
      region: step.place.region,
      activity_bucket: getPlaceActivityBucket(step.place),
      score: Number(step.place.score.toFixed(2)),
    })),
  }));

  return `너는 오늘오디가? 큐레이션 어시스턴트야.

다음 정보를 바탕으로 사용자에게 노출할 추천 이유/스토리를 만든다.

입력:
- intent: ${JSON.stringify(intent)}
- places: ${JSON.stringify(placeInputs)}
- courses: ${JSON.stringify(courseInputs)}

출력 조건:
- 반드시 valid JSON만 출력
- 모든 아이템에 id와 추천 이유가 반드시 있어야 함
- confidence 값은 high/medium/low 중 하나
- places/course 항목 개수는 입력 개수와 같을 수 있음

반드시 아래 스키마를 그대로 따른다:
{
  "curated_summary": "string",
  "confidence": "high" | "medium" | "low",
  "places": [
    {
      "id": "string",
      "recommendation_reason": "string",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "courses": [
    {
      "id": number,
      "recommendation_reason": "string",
      "confidence": "high" | "medium" | "low",
      "course_story": "string",
      "mood_flow": ["string"],
      "ideal_time": "string"
    }
  ]
}`;
}

function parseCuratedResponse(payload: unknown): Partial<LlmResponse> | null {
  if (!payload || typeof payload !== 'object') return null;
  return payload as Partial<LlmResponse>;
}

async function callLLMForCuration(topPlaces: ScoredPlace[], topCourses: Course[], intent: ParsedIntent): Promise<LlmResponse> {
  const llm = getLLM();
  const response = await llm.invoke([new HumanMessage(buildPrompt(topPlaces, topCourses, intent))]);
  let content = typeof response.content === 'string' ? response.content : '';

  content = content.trim();
  const fenceMatch = content.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) content = fenceMatch[1].trim();

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid JSON response from curator');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parseCuratedResponse(parsed) ?? {};
}

function buildCourseCurationPrompt(courses: Course[], intent: ParsedIntent): string {
  const region = intent.region || '지역 미지정';
  const vibeText = intent.vibe.join(', ') || '';

  const coursesInput = courses.map((course, idx) => {
    const steps = course.steps.map((step, i) =>
      `  [${i + 1}] ${step.place.name} (${getPlaceActivityBucket(step.place)})`,
    ).join('\n');
    return `코스 ${idx + 1}:\n${steps}`;
  }).join('\n\n');

  return `너는 "오늘오디가?"의 내부 큐레이터다.
이 출력은 CLI 화면에 표시된다.
가독성을 최우선으로 하라.

규칙:
1. 불필요하게 길게 쓰지 말 것.
2. 한 문장은 최대 2줄 이내.
3. 감정 과장 금지.
4. 점수, 평점 언급 금지.
5. 구조화된 텍스트로 작성하라.
6. 구분선과 번호 구조를 활용하라.
7. 스크롤을 최소화하라.

출력은 아래 형식의 텍스트로 반환하라. JSON 금지.
코스가 여러 개일 경우 각 코스 블록 사이에 반드시 "---" 구분선을 삽입하라.

출력 형식 (코스마다 반복):
🔥 오늘오디가의 제안

[지역명], [한 줄 상황 설명]

[한 줄 흐름 설명]

이런 날:
• [상황1]
• [상황2]

— 흐름 —
[활동1] → [활동2] → [활동3]

[1] [장소명]
   왜 여기: [한 문장]
   순서 이유: [한 문장]

확신도: 높음/보통/낮음

---

사용자 쿼리: ${vibeText}
지역: ${region}

코스 목록:
${coursesInput}`;
}

async function callLLMForCourseCuration(courses: Course[], intent: ParsedIntent): Promise<string[]> {
  if (courses.length === 0) return [];
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');
  const llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    maxOutputTokens: 1500,
    apiKey,
  });
  const response = await llm.invoke([new HumanMessage(buildCourseCurationPrompt(courses, intent))]);
  const content = typeof response.content === 'string' ? response.content.trim() : '';
  const blocks = content.split(/\n---\n/).map((s) => s.trim()).filter((s) => s.length > 0);
  return blocks;
}

function buildFallbackCourseText(course: Course): string {
  const region = course.steps[0]?.place.region || '지역';
  const vibeSummary = course.vibes.length > 0 ? course.vibes[0] : '코스';
  const route = course.steps.map((s) => getPlaceActivityBucket(s.place)).join(' → ');
  const steps = course.steps.map((step, i) =>
    `[${i + 1}] ${step.place.name}\n   왜 여기: 해당 지역에서 추천하는 장소입니다.\n   순서 이유: 자연스러운 동선입니다.`,
  ).join('\n\n');
  const confidence = deriveConfidenceFromScore(course.totalScore, course.steps.length);
  const confidenceKo = confidence === 'high' ? '높음' : confidence === 'medium' ? '보통' : '낮음';

  return `🔥 오늘오디가의 제안

${region}, ${vibeSummary}

— 흐름 —
${route}

${steps}

확신도: ${confidenceKo}`;
}

function applyPlaceCuration(topPlaces: ScoredPlace[], llmOutput: LlmResponse): BrandedPlace[] {
  return topPlaces.map((place, index) => {
    const item = (llmOutput.places || []).find((entry) => entry.id === place.id);
    return {
      rank: index + 1,
      place,
      recommendation_reason: toStringReason(item?.recommendation_reason, buildFallbackPlaceReasons(place, {
        vibe: [],
        activity_type: null,
      } as ParsedIntent, index + 1)),
      confidence: normalizeConfidence(item?.confidence),
    } as BrandedPlace;
  });
}

function toStringReason(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function applyCourseCuration(courses: Course[], curationTexts: string[]): BrandedCourse[] {
  return courses.map((course, idx) => {
    const curation_text = curationTexts[idx] || buildFallbackCourseText(course);
    const moodFlow = course.steps
      .map((step) => step.label)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);

    return {
      id: course.id,
      route_summary: buildRouteSummary(course),
      totalDistance: course.totalDistance,
      difficulty: course.difficulty,
      mode: course.mode,
      vibes: course.vibes,
      totalScore: course.totalScore,
      places: toCourseNarrativeSteps(course),
      recommendation_reason: buildFallbackCourseReasons(course),
      confidence: deriveConfidenceFromScore(course.totalScore, course.steps.length),
      course_story: curation_text,
      mood_flow: moodFlow,
      ideal_time: toNarrativeMinutes(course.totalDistance),
      curation_text,
    };
  });
}

export function curateWithLLM(
  scoredPlaces: ScoredPlace[],
  courses: Course[],
  intent: ParsedIntent,
): Promise<BrandedRecommendResponse> {
  const topPlaces = pickTopPlaces(scoredPlaces);
  const topCourses = pickTopCourses(courses);

  return (async () => {
    try {
      if (intent.response_type === 'course') {
        const curationTexts = await callLLMForCourseCuration(topCourses, intent);
        const parsedCourses = applyCourseCuration(topCourses, curationTexts);
        return {
          curated_summary: '',
          confidence: 'medium',
          places: [],
          courses: parsedCourses,
        };
      }

      const llmOutput = await callLLMForCuration(topPlaces, topCourses, intent);
      const parsedPlaces = applyPlaceCuration(topPlaces, llmOutput);
      const summarizedConfidence = normalizeConfidence(llmOutput.confidence);
      const curatedSummary = toStringReason(
        llmOutput.curated_summary,
        '요청 의도에 맞춰 점수가 높은 후보를 기준으로 오늘오디가가 큐레이션했습니다.',
      );

      return {
        curated_summary: curatedSummary,
        confidence: summarizedConfidence,
        places: parsedPlaces,
        courses: [],
      };
    } catch {
      return buildFallbackResponse(topPlaces, topCourses);
    }
  })();
}
