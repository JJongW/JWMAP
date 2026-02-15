import type { ScoredPlace } from './scoring';
import type { ModeConfig } from './modePlanner';
import { walkingDistance } from './distance';
import { getDifficulty, type Difficulty } from './difficulty';

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
  count: number = 3,
): Course[] {
  if (scoredPlaces.length < modeConfig.steps) {
    return buildSingleCourse(scoredPlaces, modeConfig, vibes, 1);
  }

  const courses: Course[] = [];
  const usedSets = new Set<string>();

  for (let i = 0; i < count; i++) {
    const steps = pickDiverseSteps(scoredPlaces, modeConfig, usedSets);
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
): ScoredPlace[] {
  const needed = modeConfig.steps;
  const candidates = [...places];

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

    if (picked.length === needed) {
      const key = picked.map((s) => s.id).join('|');
      if (!usedSets.has(key)) {
        return picked;
      }
    }
  }

  return [];
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
