import { describe, expect, it } from 'vitest';
import { buildCourses, type Course } from './courseBuilder';
import type { ModeConfig } from './modePlanner';
import type { ScoredPlace } from './scoring';
import { getPlaceActivityBucket } from './places';

function makeScoredPlace(
  id: string,
  categoryMain: string,
  categorySub: string,
  lat: number,
  lon: number,
  score: number,
): ScoredPlace {
  return {
    id,
    name: id,
    region: '강남',
    category_main: categoryMain,
    category_sub: categorySub,
    lat,
    lon,
    address: '서울',
    rating: 4.5,
    score,
    scoreBreakdown: {
      vibeMatch: 0.8,
      distance: 0.5,
      jjeopLevel: 0.7,
      popularity: 0.9,
      season: 0.6,
      activityMatch: 0.8,
    },
  };
}

function hasAttraction(course: Course): boolean {
  return course.steps.some((step) => getPlaceActivityBucket(step.place) === '볼거리');
}

const modeConfig: ModeConfig = {
  mode: 'date',
  steps: 3,
  labels: ['시작', '메인', '마무리'],
};

describe('buildCourses', () => {
  it('맛집 중심 코스에서도 볼거리를 최소 1개 포함한다', () => {
    const places: ScoredPlace[] = [
      makeScoredPlace('food-1', '밥', '한식', 37.5, 127.0, 0.99),
      makeScoredPlace('cafe-1', '카페', '커피', 37.501, 127.002, 0.95),
      makeScoredPlace('attraction-1', '전시/문화', '미술관', 37.503, 127.004, 0.93),
      makeScoredPlace('food-2', '면', '라멘', 37.505, 127.006, 0.9),
    ];

    const courses = buildCourses(places, modeConfig, ['데이트'], '맛집', 2);
    expect(courses.length).toBeGreaterThan(0);
    expect(courses.every(hasAttraction)).toBe(true);
  });

  it('볼거리 후보가 없으면 가능한 조합으로 코스를 만든다', () => {
    const places: ScoredPlace[] = [
      makeScoredPlace('food-1', '밥', '한식', 37.5, 127.0, 0.99),
      makeScoredPlace('cafe-1', '카페', '커피', 37.501, 127.002, 0.95),
      makeScoredPlace('food-2', '면', '라멘', 37.503, 127.004, 0.93),
      makeScoredPlace('food-3', '고기요리', '구이', 37.505, 127.006, 0.9),
    ];

    const courses = buildCourses(places, modeConfig, ['데이트'], '맛집', 1);
    expect(courses.length).toBe(1);
    expect(courses[0].steps).toHaveLength(3);
  });
});
