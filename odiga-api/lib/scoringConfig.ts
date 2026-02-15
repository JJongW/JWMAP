export interface ScoringWeights {
  vibeMatch: number;
  distance: number;
  jjeopLevel: number;
  popularity: number;
  season: number;
  activityMatch: number;
}

export interface SeasonalAdjustment {
  season: string;
  vibeBoost: string[];
  activityBoost: string[];
  penaltyVibes: string[];
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  vibeMatch: 0.30,
  distance: 0.15,
  jjeopLevel: 0.15,
  popularity: 0.15,
  season: 0.10,
  activityMatch: 0.15,
};

export const SEASONAL_ADJUSTMENTS: SeasonalAdjustment[] = [
  {
    season: '봄',
    vibeBoost: ['벚꽃', '산책', '피크닉', '야외'],
    activityBoost: ['산책', '공원', '카페'],
    penaltyVibes: ['실내', '따뜻한'],
  },
  {
    season: '여름',
    vibeBoost: ['시원한', '빙수', '냉면', '물놀이'],
    activityBoost: ['실내', '카페', '아이스크림'],
    penaltyVibes: ['뜨거운', '국물'],
  },
  {
    season: '가을',
    vibeBoost: ['단풍', '감성', '산책', '분위기'],
    activityBoost: ['산책', '카페', '전시'],
    penaltyVibes: [],
  },
  {
    season: '겨울',
    vibeBoost: ['따뜻한', '국물', '핫초코', '실내'],
    activityBoost: ['실내', '카페', '국밥'],
    penaltyVibes: ['야외', '산책'],
  },
];

export const MODE_STEP_MAP: Record<string, number> = {
  solo: 2,
  date: 3,
  group: 3,
  party: 4,
};

export function getModeFromPeopleCount(count: number): string {
  if (count <= 1) return 'solo';
  if (count === 2) return 'date';
  if (count <= 5) return 'group';
  return 'party';
}
