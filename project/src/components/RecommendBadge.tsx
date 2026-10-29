import type { Location } from '../types/location';
import { getRecommendBadge } from '../utils/curation';

interface RecommendBadgeProps {
  location: Location;
  size?: 'xs' | 'sm';
}

/** 운영자가 직접 다녀온 곳의 추천 강도. 아직 안 가본 후보에는 아무것도 그리지 않는다 */
export function RecommendBadge({ location, size = 'sm' }: RecommendBadgeProps) {
  const badge = getRecommendBadge(location);
  if (!badge) return null;
  return (
    <span
      title={badge.description}
      className={`shrink-0 font-semibold ${badge.badgeClass} ${
        size === 'xs' ? 'rounded px-1.5 py-0.5 text-xs' : 'rounded-lg px-2.5 py-1 text-sm'
      }`}
    >
      {badge.label}
    </span>
  );
}
