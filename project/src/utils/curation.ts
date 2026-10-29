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

/**
 * 자동 생성·수집 메모의 흔적. DB 이관(019)의 분류와 같은 규칙
 * 예: "분위기: 차분한 · 방문 많음", "[배치 수집] https://…", "⏰ 운영시간: 10시~19시"
 */
const AUTO_MEMO = /분위기:|방문 많음|^\[배치 수집\]|운영시간:|입장료:|전화번호:|⏰|💰|🚗|🚇|^https?:\/\/\S+$|- (리뷰|리뷰 메모|지도 소개|해시태그|카맵 평점|카맵 후기 수|공식 URL|대중교통):/m;

export type NoteOrigin = 'operator_note' | 'auto_generated' | 'address' | 'empty';

/**
 * '직접 가본 메모'로 보여도 되는지. 메모 칸에는 자동 정리·외부 소개 문구가 섞여 있어서
 * 운영자가 직접 방문한 곳이고, 자동 문구·주소가 아닐 때만 그렇게 부른다.
 */
export function isFirstHandMemo(location: CuratorFields): boolean {
  return isCuratorVisited(location) && classifyNote(location.memo, location.address) === 'operator_note';
}

/** 원문 메모가 운영자가 쓴 글인지, 자동 정리 문구인지, 주소인지. 원문은 바꾸지 않고 분류만 한다 */
export function classifyNote(text: string | undefined, address?: string): NoteOrigin {
  const value = text?.trim() ?? '';
  if (!value) return 'empty';
  if (looksLikeAddress(value, address)) return 'address';
  if (AUTO_MEMO.test(value)) return 'auto_generated';
  return 'operator_note';
}

/** 데이터에 직접 방문(true)으로 적힌 곳만 직접 방문이다. 값이 비어 있으면 방문했다고 말하지 않는다 */
export function isCuratorVisited(location: CuratorFields): boolean {
  return location.curator_visited === true;
}

export const VISIT_STATUS_LABEL = {
  visited: '운영자 직접 방문',
  candidate: '아직 안 가본 후보',
} as const;

export function getVisitStatusLabel(location: CuratorFields): string {
  return isCuratorVisited(location) ? VISIT_STATUS_LABEL.visited : VISIT_STATUS_LABEL.candidate;
}

// ─────────────────────────────────────────────
// 추천 강도 배지: 방문 여부와 섞이지 않게 '직접 다녀온 곳'에만 붙인다
// ─────────────────────────────────────────────

export interface RecommendBadge {
  label: string;
  description: string;
  badgeClass: string;
}

export const RECOMMEND_BADGES: RecommendBadge[] = [
  { label: '운영자 추천', description: '직접 다녀와서 추천하는 곳', badgeClass: 'bg-emerald-50 text-emerald-700' },
  { label: '대표픽', description: '직접 다녀온 곳 중 특히 추천하는 곳', badgeClass: 'bg-orange-100 text-orange-700' },
];

/**
 * 직접 방문 + 큐레이션 3단계 이상일 때만 추천 강도 배지를 준다.
 * 아직 안 가본 후보는 curation_level이 높아도 배지를 달지 않는다 (방문·검증 주장이 되지 않게).
 */
export function getRecommendBadge(
  location: CuratorFields & Partial<Pick<Location, 'curation_level' | 'rating'>>,
): RecommendBadge | null {
  if (!isCuratorVisited(location)) return null;
  const level = location.curation_level ?? ratingToCurationLevel(location.rating ?? 0);
  if (level >= 4) return RECOMMEND_BADGES[1];
  if (level >= 3) return RECOMMEND_BADGES[0];
  return null;
}

const UNVISITED_BASIS_LABEL: Record<string, string> = { friend: '지인 추천', research: '직접 찾아봄', wishlist: '가보고 싶은 곳' };

/** 안 가본 곳의 공개 추천이면 "아직 안 가봤어요 · 지인 추천" 같은 꼬리표. 가본 곳이거나 근거가 없으면 '' */
export function getUnvisitedBasisLabel(location: { recommend_basis?: string | null }): string {
  const basis = location.recommend_basis;
  if (!basis || basis === 'visited') return '';
  return `아직 안 가봤어요 · ${UNVISITED_BASIS_LABEL[basis] ?? '추천'}`;
}
