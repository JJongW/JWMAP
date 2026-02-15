import { SEASONAL_ADJUSTMENTS } from './scoringConfig';

export function getSeasonBoost(season: string | null, vibes: string[], activity: string | null): number {
  if (!season) return 0;

  const adjustment = SEASONAL_ADJUSTMENTS.find((a) => a.season === season);
  if (!adjustment) return 0;

  let boost = 0;

  for (const vibe of vibes) {
    if (adjustment.vibeBoost.some((v) => vibe.includes(v))) {
      boost += 0.15;
    }
    if (adjustment.penaltyVibes.some((v) => vibe.includes(v))) {
      boost -= 0.1;
    }
  }

  if (activity && adjustment.activityBoost.some((a) => activity.includes(a))) {
    boost += 0.1;
  }

  return Math.max(-0.3, Math.min(0.3, boost));
}

export function detectCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}
