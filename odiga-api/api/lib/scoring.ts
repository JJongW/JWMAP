import type { Place } from './places';
import type { ParsedIntent } from './intent';
import { DEFAULT_WEIGHTS, type ScoringWeights } from './scoringConfig';
import { getSeasonBoost } from './season';

export interface ScoredPlace extends Place {
  score: number;
  scoreBreakdown: {
    vibeMatch: number;
    distance: number;
    jjeopLevel: number;
    popularity: number;
    season: number;
    activityMatch: number;
  };
}

function vibeMatchScore(place: Place, vibes: string[]): number {
  if (vibes.length === 0) return 0.5;

  const tags = place.tags || [];
  const memo = (place.memo || '').toLowerCase();
  const shortDesc = (place.short_desc || '').toLowerCase();
  const searchText = [...tags.map((t) => t.toLowerCase()), memo, shortDesc].join(' ');

  let matches = 0;
  for (const vibe of vibes) {
    if (searchText.includes(vibe.toLowerCase())) {
      matches++;
    }
  }

  return vibes.length > 0 ? matches / vibes.length : 0;
}

function activityMatchScore(place: Place, activityType: string | null): number {
  if (!activityType) return 0.5;

  const category = `${place.category_main || ''} ${place.category_sub || ''}`.toLowerCase();
  const tags = (place.tags || []).join(' ').toLowerCase();

  if (category.includes(activityType.toLowerCase())) return 1.0;
  if (tags.includes(activityType.toLowerCase())) return 0.7;
  return 0.1;
}

function popularityScore(place: Place): number {
  return Math.min(1.0, (place.rating || 0) / 5.0);
}

function jjeopLevelScore(place: Place): number {
  const features = place.features || {};
  let score = 0.5;
  if (features.date_ok) score += 0.15;
  if (features.quiet) score += 0.1;
  if (features.solo_ok) score += 0.1;
  if (features.reservation) score += 0.05;
  return Math.min(1.0, score);
}

export function scorePlaces(
  places: Place[],
  intent: ParsedIntent,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredPlace[] {
  return places
    .map((place) => {
      const vibe = vibeMatchScore(place, intent.vibe);
      const activity = activityMatchScore(place, intent.activity_type);
      const popularity = popularityScore(place);
      const jjeop = jjeopLevelScore(place);
      const season = getSeasonBoost(intent.season, intent.vibe, intent.activity_type);

      const score =
        vibe * weights.vibeMatch +
        0.5 * weights.distance +
        jjeop * weights.jjeopLevel +
        popularity * weights.popularity +
        (0.5 + season) * weights.season +
        activity * weights.activityMatch;

      return {
        ...place,
        score,
        scoreBreakdown: {
          vibeMatch: vibe,
          distance: 0.5,
          jjeopLevel: jjeop,
          popularity,
          season: 0.5 + season,
          activityMatch: activity,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}
