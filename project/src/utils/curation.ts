/**
 * 큐레이션 레벨 시스템
 * 기존 3단계 평점(rating)을 5단계 큐레이션 레벨로 교체
 * 주인장 모드(VITE_OWNER_MODE=true)에서만 수정 가능
 */

import type { Location } from '../types/location';

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

// ─────────────────────────────────────────────
// 운영자 추천 이유 / 방문 정보 분리
// ─────────────────────────────────────────────

type CuratorFields = Partial<Pick<Location, 'short_desc' | 'memo' | 'curator_visited' | 'address'>>;

const PROVINCE_PREFIX = /^(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|충청|전북|전남|전라|경북|경남|경상|제주)\S*\s/;

/** short_desc에 주소가 들어간 데이터가 많아(2026-10 기준 423개 중 337개) 주소처럼 보이면 걸러낸다 */
function looksLikeAddress(text: string, address?: string): boolean {
  if (address && text === address.trim()) return true;
  return PROVINCE_PREFIX.test(text) && /\d/.test(text);
}

/**
 * 카드·상세에서 "추천 이유"로 보여줄 운영자 한 줄.
 * short_desc만 쓴다. memo는 주차·분위기 같은 자동 생성 설명이 대부분이라 추천 이유로 쓰지 않는다.
 */
export function getCuratorReason(location: CuratorFields): string {
  const text = location.short_desc?.trim() ?? '';
  if (!text || looksLikeAddress(text, location.address)) return '';
  return text;
}

/** 주차·포장·예약처럼 고를 이유가 아니라 찾아갈 때 필요한 정보성 태그 */
export function isPracticalInfoTag(tag: string): boolean {
  return /주차|포장|배달|예약|웨이팅|이동약자|좁음/.test(tag);
}

/** 방문 정보 섹션에 넣을 자동 생성/참고 설명 (memo) */
export function getVisitInfoText(location: CuratorFields): string {
  return location.memo?.trim() ?? '';
}

/** curator_visited가 비어 있으면 기존 데이터 호환을 위해 직접 방문으로 본다 */
export function isCuratorVisited(location: CuratorFields): boolean {
  return location.curator_visited !== false;
}

export const VISIT_STATUS_LABEL = {
  visited: '운영자 직접 방문',
  candidate: '아직 안 가본 후보',
} as const;

export function getVisitStatusLabel(location: CuratorFields): string {
  return isCuratorVisited(location) ? VISIT_STATUS_LABEL.visited : VISIT_STATUS_LABEL.candidate;
}
