import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Copy, Check, Navigation, ExternalLink } from 'lucide-react';
import type { Location, Review, Features } from '../types/location';
import { reviewApi, clickLogApi } from '../utils/supabase';
import { getDetailImageUrl } from '../utils/image';
import { ProofBar } from './ProofBar';
import { CommunityReviews } from './CommunityReviews';
import { AddReviewModal } from './AddReviewModal';

interface SidebarDetailProps {
  location: Location;
  onBack: () => void;
  searchId?: string | null;
}

const featureLabels: Record<keyof Features, string> = {
  solo_ok: '혼밥 가능',
  quiet: '조용한 분위기',
  wait_short: '웨이팅 짧음',
  date_ok: '데이트 추천',
  group_ok: '단체석 있음',
  parking: '주차 가능',
  pet_friendly: '반려동물 동반',
  reservation: '예약 가능',
  late_night: '심야 영업',
};

export function SidebarDetail({ location, onBack, searchId }: SidebarDetailProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
  const [isAddReviewOpen, setIsAddReviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Load reviews
  useEffect(() => {
    const loadReviews = async () => {
      const [reviewsData, count] = await Promise.all([
        reviewApi.getByLocationId(location.id),
        reviewApi.getCount(location.id),
      ]);
      setReviews(reviewsData);
      setReviewCount(count);
    };
    loadReviews();

    // 상세 보기 로그
    clickLogApi.log({
      location_id: location.id,
      action_type: 'view_detail',
      search_id: searchId,
    });
  }, [location.id, searchId]);

  // Copy address
  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(location.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // 주소 복사 로그
      clickLogApi.log({
        location_id: location.id,
        action_type: 'copy_address',
        search_id: searchId,
      });
    } catch (err) {
      console.error('주소 복사 실패:', err);
    }
  };

  // Open Naver Map
  const handleOpenNaver = () => {
    // 네이버 지도 열기 로그
    clickLogApi.log({
      location_id: location.id,
      action_type: 'open_naver',
      search_id: searchId,
    });

    const appName = encodeURIComponent(window.location.origin);
    const query = encodeURIComponent(location.name);
    const appLink = `nmap://search?query=${query}&appname=${appName}`;
    const webLink = `https://map.naver.com/v5/search/${query}`;

    window.location.href = appLink;
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  };

  // Open Kakao Map
  const handleOpenKakao = () => {
    // 카카오맵 열기 로그
    clickLogApi.log({
      location_id: location.id,
      action_type: 'open_kakao',
      search_id: searchId,
    });

    const query = encodeURIComponent(location.name);
    const appLink = `kakaomap://search?q=${query}`;
    const webLink = `https://map.kakao.com/link/search/${query}`;

    window.location.href = appLink;
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  };

  // Get active features
  const activeFeatures = location.features
    ? Object.entries(location.features)
        .filter(([, value]) => value)
        .map(([key]) => ({
          key: key as keyof Features,
          label: featureLabels[key as keyof Features],
        }))
    : [];

  // Handle review added
  const handleReviewAdded = (newReview: Review) => {
    setReviews(prev => [newReview, ...prev]);
    setReviewCount(prev => prev + 1);
    setIsReviewsExpanded(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-500">{location.category}</span>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Cover Image */}
        {location.imageUrl && !imageError && (
          <div className="relative h-52 bg-gray-100">
            <img
              src={getDetailImageUrl(location.imageUrl)}
              alt={location.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Title & Rating */}
          <div>
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold text-gray-900">{location.name}</h2>
              {location.rating > 0 && (
                <div className="flex items-center gap-1 text-orange-500 flex-shrink-0 ml-3">
                  <Star size={18} className="fill-current" />
                  <span className="font-semibold text-lg">{location.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{location.region}</p>

            {/* Address with copy */}
            <div className="flex items-center gap-2 mt-2">
              <MapPin size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-600 flex-1">{location.address}</span>
              <button
                onClick={handleCopyAddress}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="주소 복사"
              >
                {copied ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <Copy size={16} className="text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* ProofBar */}
          <ProofBar
            visitedAt={location.curator_visited_at}
            visitSlot={location.curator_visit_slot}
            disclosure={location.disclosure}
          />

          {/* One-liner (Verdict) */}
          {location.short_desc && (
            <div className="bg-orange-50 rounded-xl p-4">
              <p className="text-base font-medium text-gray-900 leading-relaxed">
                "{location.short_desc}"
              </p>
            </div>
          )}

          {/* Features */}
          {activeFeatures.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFeatures.map(({ key, label }) => (
                <span
                  key={key}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {location.tags && location.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {location.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2.5 py-1 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Memo (if different from short_desc) */}
          {location.memo && location.memo !== location.short_desc && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-600 leading-relaxed">{location.memo}</p>
            </div>
          )}

          {/* Community Reviews */}
          <CommunityReviews
            reviews={reviews}
            reviewCount={reviewCount}
            isExpanded={isReviewsExpanded}
            onToggle={() => setIsReviewsExpanded(!isReviewsExpanded)}
          />

          {/* Add Review Button */}
          <button
            onClick={() => setIsAddReviewOpen(true)}
            className="w-full py-3 bg-white border-2 border-dashed border-gray-300 text-gray-600 font-medium rounded-xl hover:border-orange-400 hover:text-orange-500 transition-colors"
          >
            나도 다녀왔어요
          </button>
        </div>

        {/* Bottom padding for sticky CTA */}
        <div className="h-20" />
      </div>

      {/* Sticky CTA Row */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-white flex gap-2">
        <button
          onClick={handleOpenNaver}
          className="flex-1 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
        >
          <Navigation size={16} />
          네이버지도
        </button>
        <button
          onClick={handleOpenKakao}
          className="flex-1 py-3 bg-yellow-400 text-gray-900 font-medium rounded-xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink size={16} />
          카카오맵
        </button>
      </div>

      {/* Add Review Modal */}
      {isAddReviewOpen && (
        <AddReviewModal
          locationId={location.id}
          locationName={location.name}
          onClose={() => setIsAddReviewOpen(false)}
          onSuccess={handleReviewAdded}
        />
      )}
    </div>
  );
}
