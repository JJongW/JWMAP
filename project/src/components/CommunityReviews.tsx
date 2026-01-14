import { ChevronDown, ChevronUp, Users, RefreshCw } from 'lucide-react';
import type { Review, Features } from '../types/location';

interface CommunityReviewsProps {
  reviews: Review[];
  reviewCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

// Features 라벨 매핑
const featureLabels: Record<keyof Features, string> = {
  solo_ok: '혼밥',
  quiet: '조용함',
  wait_short: '웨이팅 짧음',
  date_ok: '데이트',
  group_ok: '단체석',
  parking: '주차',
  pet_friendly: '반려동물',
  reservation: '예약',
  late_night: '심야',
};

// 날짜 포맷팅
const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
    return `${Math.floor(diffDays / 365)}년 전`;
  } catch {
    return '';
  }
};

export function CommunityReviews({
  reviews,
  reviewCount,
  isExpanded,
  onToggle,
}: CommunityReviewsProps) {
  // 리뷰가 없으면 섹션 숨김
  if (reviewCount === 0) {
    return null;
  }

  // 표시할 리뷰 (확장 시 모든 리뷰, 축소 시 3개만)
  const displayedReviews = isExpanded ? reviews : reviews.slice(0, 3);

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      {/* 헤더 (접기/펼치기 토글) */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3.5 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users size={18} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">
            다른 사람들의 방문 기록
          </span>
          <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-full">
            {reviewCount}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={20} className="text-gray-400" />
        ) : (
          <ChevronDown size={20} className="text-gray-400" />
        )}
      </button>

      {/* 리뷰 목록 (펼쳐진 경우에만) */}
      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {displayedReviews.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}

          {/* 더보기 안내 (표시된 리뷰보다 전체가 많을 경우) */}
          {reviews.length < reviewCount && (
            <div className="px-4 py-3 text-center">
              <span className="text-xs text-gray-400">
                {reviewCount - reviews.length}개의 리뷰가 더 있습니다
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 개별 리뷰 아이템
function ReviewItem({ review }: { review: Review }) {
  // 활성화된 Features 추출
  const activeFeatures = review.features
    ? Object.entries(review.features)
        .filter(([, value]) => value)
        .map(([key]) => ({
          key: key as keyof Features,
          label: featureLabels[key as keyof Features],
        }))
        .slice(0, 3)
    : [];

  return (
    <div className="px-4 py-3.5">
      {/* 상단: 사용자명 + 재방문 배지 + 날짜 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-800">
          {review.user_display_name || '익명'}
        </span>
        {review.visit_type === 'revisit' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded">
            <RefreshCw size={10} />
            재방문
          </span>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {formatDate(review.created_at)}
        </span>
      </div>

      {/* 원라이너 */}
      <p className="text-sm text-gray-700 leading-relaxed">
        "{review.one_liner}"
      </p>

      {/* Features 태그 */}
      {activeFeatures.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {activeFeatures.map(({ key, label }) => (
            <span
              key={key}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
