/**
 * 큐레이션 레벨 시스템
 * 기존 3단계 평점(rating)을 5단계 큐레이션 레벨로 교체
 * 주인장 모드(VITE_OWNER_MODE=true)에서만 수정 가능
 */

/** 주인장 모드: 큐레이션 레벨 수정 가능 (환경변수 VITE_OWNER_MODE=true) */
export const isOwnerMode = import.meta.env.VITE_OWNER_MODE === 'true';

export interface CurationTier {
  level: number;
  label: string;
  description: string;
  color: string; // tailwind color name
  bgClass: string;
  textClass: string;
  badgeClass: string;
}

const CURATION_TIERS: CurationTier[] = [
  { level: 1, label: '후보', description: '궁금해서 저장해둔 곳', color: 'slate', bgClass: 'bg-slate-100', textClass: 'text-slate-700', badgeClass: 'bg-slate-100 text-slate-700' },
  { level: 2, label: '가볼만함', description: '조건이 맞으면 들러볼 만한 곳', color: 'sky', bgClass: 'bg-sky-100', textClass: 'text-sky-700', badgeClass: 'bg-sky-100 text-sky-700' },
  { level: 3, label: '검증됨', description: '믿고 후보에 넣기 좋은 곳', color: 'emerald', bgClass: 'bg-emerald-100', textClass: 'text-emerald-700', badgeClass: 'bg-emerald-100 text-emerald-700' },
  { level: 4, label: '강력추천', description: '먼저 봐도 좋은 우선 후보', color: 'orange', bgClass: 'bg-orange-100', textClass: 'text-orange-700', badgeClass: 'bg-orange-100 text-orange-700' },
  { level: 5, label: '대표픽', description: '이 지도에서 특히 기억할 만한 곳', color: 'rose', bgClass: 'bg-rose-100', textClass: 'text-rose-700', badgeClass: 'bg-rose-100 text-rose-700' },
];

const DISPLAY_CURATION_TIERS: CurationTier[] = [
  { level: 1, label: '후보', description: '가볍게 비교해볼 후보', color: 'slate', bgClass: 'bg-slate-100', textClass: 'text-slate-700', badgeClass: 'bg-slate-100 text-slate-700' },
  { level: 3, label: '검증됨', description: '믿고 후보에 넣기 좋은 곳', color: 'emerald', bgClass: 'bg-emerald-100', textClass: 'text-emerald-700', badgeClass: 'bg-emerald-100 text-emerald-700' },
  { level: 5, label: '대표픽', description: '먼저 봐도 좋은 우선 후보', color: 'orange', bgClass: 'bg-orange-100', textClass: 'text-orange-700', badgeClass: 'bg-orange-100 text-orange-700' },
];

/** 큐레이션 레벨에 해당하는 Tier 정보 반환 */
export function getCurationTier(level: number): CurationTier {
  return CURATION_TIERS.find(t => t.level === level) || CURATION_TIERS[0];
}

function getDisplayCurationTier(level: number): CurationTier {
  if (level >= 4) return DISPLAY_CURATION_TIERS[2];
  if (level >= 3) return DISPLAY_CURATION_TIERS[1];
  return DISPLAY_CURATION_TIERS[0];
}

/** 큐레이션 레벨 라벨 반환 */
export function getCurationLabel(level: number): string {
  return getDisplayCurationTier(level).label;
}

/** 큐레이션 레벨 설명 반환 */
export function getCurationDescription(level: number): string {
  return getDisplayCurationTier(level).description;
}

/** 큐레이션 뱃지 CSS 클래스 반환 */
export function getCurationBadgeClass(level: number): string {
  return getDisplayCurationTier(level).badgeClass;
}

/** 모든 큐레이션 레벨 목록 */
export const CURATION_LEVELS = CURATION_TIERS;

/** 가격대 라벨 (1~4) */
export function getPriceLevelLabel(level: number | null | undefined): string | null {
  if (!level) return null;
  const map: Record<number, string> = { 1: '₩', 2: '₩₩', 3: '₩₩₩', 4: '₩₩₩₩' };
  return map[level] ?? null;
}

/** 가격대 설명 */
export function getPriceLevelDesc(level: number | null | undefined): string | null {
  if (!level) return null;
  const map: Record<number, string> = { 1: '가성비', 2: '보통', 3: '다소 비싼', 4: '고급' };
  return map[level] ?? null;
}

/** 기존 rating 숫자를 큐레이션 레벨로 변환 (하위호환) */
export function ratingToCurationLevel(rating: number): number {
  if (rating >= 4) return 4;    // 원픽 → 강력추천
  if (rating >= 2.5) return 2;  // 자주 방문 → 가볼만함
  return 1;                     // 모르겠음 → 후보
}
