/**
 * 쩝쩝박사 레이팅 시스템
 * 별점 숫자 대신 주인장 만의 3단계 라벨로 표시
 * 주인장 모드(VITE_OWNER_MODE=true)에서만 수정 가능
 */

/** 주인장 모드: 쩝쩝박사 라벨 수정 가능 (환경변수 VITE_OWNER_MODE=true) */
export const isOwnerMode = import.meta.env.VITE_OWNER_MODE === 'true';
export type RatingLabel = '쩝쩝박사 원픽' | '쩝쩝박사 자주 방문' | '쩝쩝박사 모르겠음';

export const RATING_LABELS: RatingLabel[] = [
  '쩝쩝박사 원픽',
  '쩝쩝박사 자주 방문',
  '쩝쩝박사 모르겠음',
];

/** rating 숫자를 쩝쩝박사 라벨로 변환 */
export function getRatingLabel(rating: number): RatingLabel {
  if (rating >= 4) return '쩝쩝박사 원픽';
  if (rating >= 2.5) return '쩝쩝박사 자주 방문';
  return '쩝쩝박사 모르겠음';
}

/** 라벨을 rating 숫자로 변환 (저장용) */
export function getRatingFromLabel(label: RatingLabel): number {
  switch (label) {
    case '쩝쩝박사 원픽':
      return 4.5;
    case '쩝쩝박사 자주 방문':
      return 3.25;
    case '쩝쩝박사 모르겠음':
      return 1.5;
    default:
      return 0;
  }
}
