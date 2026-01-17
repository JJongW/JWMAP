import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Copy, Check, Navigation, ExternalLink, Edit2, Share2 } from 'lucide-react';
import type { Location, Review, Features } from '../types/location';
import { reviewApi, clickLogApi } from '../utils/supabase';
import { getDetailImageUrl } from '../utils/image';
import { shareToKakao } from '../utils/kakaoShare';
import { ProofBar } from './ProofBar';
import { CommunityReviews } from './CommunityReviews';
import { AddReviewModal } from './AddReviewModal';
import { LocationCard } from './LocationCard';

interface SidebarDetailProps {
  location: Location;
  onBack: () => void;
  searchId?: string | null;
  onUpdate?: (updatedLocation: Location) => void;
  onDelete?: (id: string) => void;
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

export function SidebarDetail({ location, onBack, searchId, onUpdate, onDelete }: SidebarDetailProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
  const [isAddReviewOpen, setIsAddReviewOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(location);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Update current location when prop changes
  useEffect(() => {
    setCurrentLocation(location);
  }, [location]);

  // Load reviews
  useEffect(() => {
    const loadReviews = async () => {
      const [reviewsData, count] = await Promise.all([
        reviewApi.getByLocationId(currentLocation.id),
        reviewApi.getCount(currentLocation.id),
      ]);
      setReviews(reviewsData);
      setReviewCount(count);
    };
    loadReviews();

    // 상세 보기 로그
    clickLogApi.log({
      location_id: currentLocation.id,
      action_type: 'view_detail',
      search_id: searchId,
    });
  }, [currentLocation.id, searchId]);

  // Copy address
  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(currentLocation.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // 주소 복사 로그
      clickLogApi.log({
        location_id: currentLocation.id,
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
      location_id: currentLocation.id,
      action_type: 'open_naver',
      search_id: searchId,
    });

    const appName = encodeURIComponent(window.location.origin);
    const query = encodeURIComponent(currentLocation.name);
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
      location_id: currentLocation.id,
      action_type: 'open_kakao',
      search_id: searchId,
    });

    const query = encodeURIComponent(currentLocation.name);
    const appLink = `kakaomap://search?q=${query}`;
    const webLink = `https://map.kakao.com/link/search/${query}`;

    window.location.href = appLink;
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  };

  // 카카오톡 공유
  const handleShareKakao = () => {
    shareToKakao(currentLocation);
  };

  // Get active features
  const activeFeatures = currentLocation.features
    ? Object.entries(currentLocation.features)
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

  // Handle location update
  const handleLocationUpdate = (updatedLocation: Location) => {
    setCurrentLocation(updatedLocation);
    if (onUpdate) {
      onUpdate(updatedLocation);
    }
    setIsEditMode(false);
  };

  // Handle location delete
  const handleLocationDelete = (id: string) => {
    if (onDelete) {
      onDelete(id);
    }
    onBack();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-base bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-base transition-colors"
          >
            <ArrowLeft size={20} className="text-accent/80" />
          </button>
          <span className="text-sm font-medium text-accent/70">
            {currentLocation.categorySub || currentLocation.category || '미분류'}
          </span>
        </div>
        {!isEditMode && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleShareKakao}
              className="p-1.5 rounded-lg hover:bg-base transition-colors"
              title="카카오톡 공유"
            >
              <Share2 size={18} className="text-accent/80" />
            </button>
            {(onUpdate || onDelete) && (
              <button
                onClick={() => setIsEditMode(true)}
                className="p-1.5 rounded-lg hover:bg-base transition-colors"
                title="수정"
              >
                <Edit2 size={18} className="text-accent/80" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {isEditMode ? (
          /* Edit Mode - Use LocationCard for editing */
          <LocationCard
            location={currentLocation}
            onDelete={handleLocationDelete}
            onUpdate={handleLocationUpdate}
          />
        ) : (
          /* View Mode - Original detail view */
          <>
            {/* Cover Image - Square */}
            {currentLocation.imageUrl && !imageError && (
              <div className="relative aspect-square bg-base">
                <img
                  src={getDetailImageUrl(currentLocation.imageUrl)}
                  alt={currentLocation.name}
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
                  <h2 className="text-xl font-bold text-accent">{currentLocation.name}</h2>
                  {currentLocation.rating > 0 && (
                    <div className="flex items-center gap-1 text-point flex-shrink-0 ml-3">
                      <Star size={18} className="fill-current" />
                      <span className="font-semibold text-lg">{currentLocation.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-accent/70 mt-1">{currentLocation.region}</p>

                {/* Address with copy */}
                <div className="flex items-center gap-2 mt-2">
                  <MapPin size={14} className="text-accent/50 flex-shrink-0" />
                  <span className="text-sm text-accent/80 flex-1">{currentLocation.address}</span>
                  <button
                    onClick={handleCopyAddress}
                    className="p-1.5 rounded-lg hover:bg-base transition-colors"
                    title="주소 복사"
                  >
                    {copied ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} className="text-accent/50" />
                    )}
                  </button>
                </div>
              </div>

              {/* ProofBar */}
              <ProofBar
                visitedAt={currentLocation.curator_visited_at}
                visitSlot={currentLocation.curator_visit_slot}
                disclosure={currentLocation.disclosure}
              />

              {/* One-liner (Verdict) */}
              {currentLocation.short_desc && (
                <div className="bg-[#FF8A3D] rounded-xl p-4">
                  <p className="text-base font-medium text-[#FFF7ED] leading-relaxed">
                    "{currentLocation.short_desc}"
                  </p>
                </div>
              )}

              {/* Features */}
              {activeFeatures.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeFeatures.map(({ key, label }) => (
                    <span
                      key={key}
                      className="px-3 py-1.5 bg-base text-accent text-sm font-medium rounded-xl"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {/* Tags */}
              {currentLocation.tags && currentLocation.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {currentLocation.tags.map(tag => (
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
              {currentLocation.memo && currentLocation.memo !== currentLocation.short_desc && (
                <div className="bg-base rounded-xl p-4">
                  <p className="text-sm text-accent/80 leading-relaxed">{currentLocation.memo}</p>
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
                className="w-full py-3 bg-white border-2 border-dashed border-base text-accent/80 font-medium rounded-xl hover:border-point hover:text-point transition-colors"
              >
                나도 다녀왔어요
              </button>
            </div>

            {/* Bottom padding for sticky CTA */}
            <div className="h-20" />
          </>
        )}
      </div>

      {/* Sticky CTA Row - Only show in view mode */}
      {!isEditMode && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-base bg-white flex gap-2">
          <button
            onClick={handleShareKakao}
            className="py-3 px-4 bg-point text-white font-medium rounded-xl hover:bg-point-hover transition-colors flex items-center justify-center"
            title="카카오톡 공유"
          >
            <Share2 size={18} />
          </button>
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
      )}

      {/* Add Review Modal */}
      {isAddReviewOpen && (
        <AddReviewModal
          locationId={currentLocation.id}
          locationName={currentLocation.name}
          onClose={() => setIsAddReviewOpen(false)}
          onSuccess={handleReviewAdded}
        />
      )}
    </div>
  );
}
