/**
 * 가격대 뱃지 컴포넌트
 * price_level(1~4)에 따라 won.svg 아이콘 개수 표시
 */

interface PriceLevelBadgeProps {
  priceLevel: number | null | undefined;
  /** 'xs': 작은 뱃지 (리스트/프리뷰), 'sm': 기본 뱃지 (상세/결과) */
  size?: 'xs' | 'sm';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'px-1.5 py-0.5 gap-0.5 rounded text-xs font-medium',
  sm: 'px-2.5 py-1 gap-1 rounded-lg text-sm font-medium',
} as const;

const ICON_SIZES = {
  xs: 12,
  sm: 14,
} as const;

export function PriceLevelBadge({
  priceLevel,
  size = 'sm',
  className = '',
}: PriceLevelBadgeProps) {
  if (!priceLevel || priceLevel < 1 || priceLevel > 4) return null;

  const count = Math.min(4, Math.max(1, priceLevel));
  const iconSize = ICON_SIZES[size];

  return (
    <span
      className={`inline-flex items-center bg-emerald-50 text-emerald-700 ${SIZE_CLASSES[size]} ${className}`}
      aria-label={`가격대 ${count}단계`}
    >
      {Array.from({ length: count }, (_, i) => (
        <img
          key={i}
          src="/won.svg"
          alt=""
          width={iconSize}
          height={iconSize}
          className="flex-shrink-0"
        />
      ))}
    </span>
  );
}
