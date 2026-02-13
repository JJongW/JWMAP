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
  color: string; // tailwind color name
  bgClass: string;
  textClass: string;
  badgeClass: string;
}

const CURATION_TIERS: CurationTier[] = [
  { level: 1, label: '눈도장', color: 'slate', bgClass: 'bg-slate-100', textClass: 'text-slate-700', badgeClass: 'bg-slate-100 text-slate-700' },
  { level: 2, label: '추천픽', color: 'blue', bgClass: 'bg-blue-100', textClass: 'text-blue-700', badgeClass: 'bg-blue-100 text-blue-700' },
  { level: 3, label: '확신픽', color: 'violet', bgClass: 'bg-violet-100', textClass: 'text-violet-700', badgeClass: 'bg-violet-100 text-violet-700' },
  { level: 4, label: '시그니처', color: 'amber', bgClass: 'bg-amber-100', textClass: 'text-amber-700', badgeClass: 'bg-amber-100 text-amber-700' },
  { level: 5, label: '아카이브', color: 'rose', bgClass: 'bg-rose-100', textClass: 'text-rose-700', badgeClass: 'bg-rose-100 text-rose-700' },
];

/** 큐레이션 레벨에 해당하는 Tier 정보 반환 */
export function getCurationTier(level: number): CurationTier {
  return CURATION_TIERS.find(t => t.level === level) || CURATION_TIERS[0];
}

/** 큐레이션 레벨 라벨 반환 */
export function getCurationLabel(level: number): string {
  return getCurationTier(level).label;
}

/** 큐레이션 뱃지 CSS 클래스 반환 */
export function getCurationBadgeClass(level: number): string {
  return getCurationTier(level).badgeClass;
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
  if (rating >= 4) return 4;    // 원픽 → 시그니처
  if (rating >= 2.5) return 2;  // 자주 방문 → 추천픽
  return 1;                     // 모르겠음 → 눈도장
}
