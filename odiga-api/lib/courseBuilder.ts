import type { ScoredPlace } from './scoring';
import type { ModeConfig } from './modePlanner';
import { walkingDistance } from './distance';
import { getDifficulty, type Difficulty } from './difficulty';
import { getPlaceActivityBucket, type PlaceActivityBucket } from './places';

export interface CourseStep {
  label: string;
  place: ScoredPlace;
  distanceFromPrev: number | null;
}

export interface Course {
  id: number;
  steps: CourseStep[];
  totalDistance: number;
  difficulty: Difficulty;
  mode: string;
  vibes: string[];
  totalScore: number;
}

export function buildCourses(
  scoredPlaces: ScoredPlace[],
  modeConfig: ModeConfig,
  vibes: string[],
  primaryActivityType: string | null = null,
  count: number = 3,
): Course[] {
  if (scoredPlaces.length < modeConfig.steps) {
    return buildSingleCourse(scoredPlaces, modeConfig, vibes, 1);
  }

  const courses: Course[] = [];
  const usedSets = new Set<string>();

  for (let i = 0; i < count; i++) {
    const steps = pickDiverseSteps(scoredPlaces, modeConfig, usedSets, primaryActivityType);
    if (steps.length === 0) break;

    const courseSteps = buildCourseSteps(steps, modeConfig.labels);
    const totalDistance = courseSteps.reduce((sum, s) => sum + (s.distanceFromPrev || 0), 0);
    const totalScore = courseSteps.reduce((sum, s) => sum + s.place.score, 0) / courseSteps.length;

    courses.push({
      id: i + 1,
      steps: courseSteps,
      totalDistance,
      difficulty: getDifficulty(totalDistance),
      mode: modeConfig.mode,
      vibes,
      totalScore,
    });

    const key = steps.map((s) => s.id).join('|');
    usedSets.add(key);
  }

  return courses;
}

function pickDiverseSteps(
  places: ScoredPlace[],
  modeConfig: ModeConfig,
  usedSets: Set<string>,
  primaryActivityType: string | null,
): ScoredPlace[] {
  const needed = modeConfig.steps;
  const candidates = [...places];
  const desiredBuckets = getDesiredBuckets(needed, primaryActivityType);
  const hasAttractionCandidate = candidates.some((place) => getPlaceActivityBucket(place) === '볼거리');

  for (let attempt = 0; attempt < 20; attempt++) {
    const picked: ScoredPlace[] = [];
    const offset = attempt * 2;

    if (offset >= candidates.length) break;
    picked.push(candidates[offset]);

    for (let i = offset + 1; i < candidates.length && picked.length < needed; i++) {
      const candidate = candidates[i];
      const tooClose = picked.some((p) => {
        const dist = walkingDistance(p.lat, p.lon, candidate.lat, candidate.lon);
        return dist < 100;
      });

      if (!tooClose) {
        picked.push(candidate);
      }
    }

    if (picked.length === needed && satisfiesBuckets(picked, desiredBuckets, false, hasAttractionCandidate)) {
      const key = picked.map((s) => s.id).join('|');
      if (!usedSets.has(key)) {
        return picked;
      }
    }
  }

  const fallback = candidates.slice(0, needed);
  if (fallback.length === needed && satisfiesBuckets(fallback, desiredBuckets, true, hasAttractionCandidate)) {
    return fallback;
  }

  return [];
}

function normalizeBucket(activityType: string | null): PlaceActivityBucket {
  if (activityType === '카페') return '카페';
  if (activityType === '볼거리') return '볼거리';
  return '맛집';
}

function getDesiredBuckets(stepCount: number, primaryActivityType: string | null): PlaceActivityBucket[] {
  const primary = normalizeBucket(primaryActivityType);

  if (stepCount <= 1) return [primary];
  if (stepCount === 2) {
    return primary === '볼거리' ? ['볼거리', '카페'] : [primary, '볼거리'];
  }
  if (primary === '카페') return ['카페', '볼거리'];
  if (primary === '볼거리') return ['볼거리', '카페'];
  return ['맛집', '볼거리'];
}

function satisfiesBuckets(
  picked: ScoredPlace[],
  desiredBuckets: PlaceActivityBucket[],
  allowPartial: boolean = false,
  requireAttraction: boolean = true,
): boolean {
  const counts = new Map<PlaceActivityBucket, number>();
  for (const place of picked) {
    const bucket = getPlaceActivityBucket(place);
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  }

  for (const bucket of new Set(desiredBuckets)) {
    const need = desiredBuckets.filter((b) => b === bucket).length;
    const has = counts.get(bucket) || 0;
    if (!requireAttraction && bucket === '볼거리') continue;
    if (has >= need) continue;
    if (allowPartial && bucket === '볼거리' && has > 0) continue;
    return false;
  }
  return true;
}

function buildCourseSteps(places: ScoredPlace[], labels: string[]): CourseStep[] {
  return places.map((place, i) => {
    let distanceFromPrev: number | null = null;
    if (i > 0) {
      const prev = places[i - 1];
      distanceFromPrev = Math.round(walkingDistance(prev.lat, prev.lon, place.lat, place.lon));
    }
    return {
      label: labels[i] || `Step ${i + 1}`,
      place,
      distanceFromPrev,
    };
  });
}

function buildSingleCourse(
  places: ScoredPlace[],
  modeConfig: ModeConfig,
  vibes: string[],
  id: number,
): Course[] {
  if (places.length === 0) return [];

  const steps = places.slice(0, modeConfig.steps);
  const courseSteps = buildCourseSteps(steps, modeConfig.labels);
  const totalDistance = courseSteps.reduce((sum, s) => sum + (s.distanceFromPrev || 0), 0);

  return [{
    id,
    steps: courseSteps,
    totalDistance,
    difficulty: getDifficulty(totalDistance),
    mode: modeConfig.mode,
    vibes,
    totalScore: steps.reduce((sum, s) => sum + s.score, 0) / steps.length,
  }];
}
