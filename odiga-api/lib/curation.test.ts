import { describe, expect, it } from 'vitest';
import { curateWithLLM } from './curation';
import type { ParsedIntent } from './intent';
import type { ScoredPlace } from './scoring';
import type { Course } from './courseBuilder';

function makePlace(overrides: Partial<ScoredPlace> = {}): ScoredPlace {
  return {
    id: 'place-1',
    name: '홍대 커피랩',
    region: '홍대/합정/마포/연남',
    lon: 126.922,
    lat: 37.554,
    address: '서울특별시 마포구',
    rating: 4.5,
    score: 0.92,
    scoreBreakdown: {
      vibeMatch: 0.9,
      distance: 0.5,
      jjeopLevel: 0.7,
      popularity: 0.8,
      season: 0.6,
      activityMatch: 0.9,
    },
    ...overrides,
  };
}

describe('curateWithLLM', () => {
  it('falls back to deterministic curation when LLM is unavailable', async () => {
    const originalKey = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const places: ScoredPlace[] = [
      makePlace({ id: 'p1', name: '첫째 장소', score: 0.9 }),
      makePlace({ id: 'p2', name: '둘째 장소', score: 0.8 }),
      makePlace({ id: 'p3', name: '셋째 장소', score: 0.7 }),
    ];

    const courses: Course[] = [
      {
        id: 1,
        steps: [
          { label: '시작', place: places[0], distanceFromPrev: null },
          { label: '마무리', place: places[1], distanceFromPrev: 250 },
        ],
        totalDistance: 250,
        difficulty: '★☆☆',
        mode: 'date',
        vibes: ['낭만'],
        totalScore: 0.85,
      },
    ];

    const intent: ParsedIntent = {
      response_type: 'course',
      region: '홍대/합정/마포/연남',
      vibe: ['카페', '산책'],
      activity_type: '카페',
      people_count: 2,
      season: '봄',
      mode: 'date',
      special_context: null,
      noise_preference: 'balanced',
      budget_sensitivity: 'moderate',
      walking_preference: 'moderate',
    };

    const result = await curateWithLLM(places, courses, intent);

    process.env.GOOGLE_API_KEY = originalKey;

    expect(result.places).toHaveLength(3);
    expect(result.courses).toHaveLength(1);
    expect(result.curated_summary).toContain('추천');
    expect(result.places[0].recommendation_reason.length).toBeGreaterThan(0);
    expect(result.courses[0].course_story).toContain('코스');
  });
});
