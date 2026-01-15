import { useState, useEffect } from 'react';
import { X, MapPin, Star, Copy, Check, ChevronDown, ChevronUp, Navigation, ExternalLink } from 'lucide-react';
import type { Location, Review, Features } from '../types/location';
import { reviewApi } from '../utils/supabase';
import { getDetailImageUrl } from '../utils/image';
import { ProofBar } from './ProofBar';
import { CommunityReviews } from './CommunityReviews';
import { AddReviewModal } from './AddReviewModal';

interface PlaceDetailProps {
  location: Location;
  onClose: () => void;
  isMobile?: boolean;
}

// Features 라벨 매핑
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

export function PlaceDetail({ location, onClose, isMobile = false }: PlaceDetailProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
  const [isAddReviewOpen, setIsAddReviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 리뷰 데이터 로드
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
  }, [location.id]);

  // 주소 복사
  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(location.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('주소 복사 실패:', err);
    }
  };

  // 네이버 지도 열기
  const handleOpenNaver = () => {
    const appName = encodeURIComponent(window.location.origin);
    const query = encodeURIComponent(location.name);
    const appLink = `nmap://search?query=${query}&appname=${appName}`;
    const webLink = `https://map.naver.com/v5/search/${query}`;

    window.location.href = appLink;
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  };

  // 카카오맵 열기
  const handleOpenKakao = () => {
    const query = encodeURIComponent(location.name);
    const appLink = `kakaomap://search?q=${query}`;
    const webLink = `https://map.kakao.com/link/search/${query}`;

    window.location.href = appLink;
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  };

  // 활성화된 Features 추출
  const activeFeatures = location.features
    ? Object.entries(location.features)
        .filter(([, value]) => value)
        .map(([key]) => ({ key: key as keyof Features, label: featureLabels[key as keyof Features] }))
        .slice(0, 4)
    : [];

  // 리뷰 추가 후 리프레시
  const handleReviewAdded = (newReview: Review) => {
    setReviews(prev => [newReview, ...prev]);
    setReviewCount(prev => prev + 1);
    setIsReviewsExpanded(true);
  };

  // 모바일 레이아웃
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 overflow-hidden flex flex-col">
        {/* 상단 헤더 */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-500">
            {location.categorySub || location.categoryMain || '미분류'}
          </span>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* 스크롤 가능한 컨텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {/* 커버 이미지 */}
          {location.imageUrl && !imageError && (
            <div className="relative h-48 bg-gray-100">
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

          <div className="p-5 space-y-5">
            {/* 헤더: 장소명, 평점, 주소 */}
            <div>
              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
                {location.rating > 0 && (
                  <div className="flex items-center gap-1 text-orange-500 flex-shrink-0 ml-3">
                    <Star size={18} className="fill-current" />
                    <span className="font-semibold">{location.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">{location.region}</p>

              {/* 주소 + 복사 버튼 */}
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

            {/* ProofBar - 큐레이터 신뢰 표시 */}
            <ProofBar
              visitedAt={location.curator_visited_at}
              visitSlot={location.curator_visit_slot}
              disclosure={location.disclosure}
            />

            {/* 큐레이터 원라이너 (Verdict) */}
            {location.short_desc && (
              <div className="bg-orange-50 rounded-2xl p-4">
                <p className="text-lg font-medium text-gray-900 leading-relaxed">
                  "{location.short_desc}"
                </p>
              </div>
            )}

            {/* Features 태그 */}
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

            {/* 메모 (있는 경우) */}
            {location.memo && location.memo !== location.short_desc && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-600 leading-relaxed">{location.memo}</p>
              </div>
            )}

            {/* 커뮤니티 리뷰 섹션 */}
            <CommunityReviews
              reviews={reviews}
              reviewCount={reviewCount}
              isExpanded={isReviewsExpanded}
              onToggle={() => setIsReviewsExpanded(!isReviewsExpanded)}
            />

            {/* 나도 다녀왔어요 버튼 */}
            <button
              onClick={() => setIsAddReviewOpen(true)}
              className="w-full py-3.5 bg-white border-2 border-dashed border-gray-300 text-gray-600 font-medium rounded-xl hover:border-orange-400 hover:text-orange-500 transition-colors"
            >
              나도 다녀왔어요
            </button>
          </div>

          {/* 하단 여백 (sticky CTA 영역) */}
          <div className="h-24" />
        </div>

        {/* Sticky 하단 CTA */}
        <div className="flex-shrink-0 bg-white border-t border-gray-100 p-4 flex gap-3">
          <button
            onClick={handleOpenNaver}
            className="flex-1 py-3.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Navigation size={18} />
            네이버지도 열기
          </button>
          <button
            onClick={handleOpenKakao}
            className="flex-1 py-3.5 bg-yellow-400 text-gray-900 font-medium rounded-xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink size={18} />
            카카오맵 열기
          </button>
        </div>

        {/* 리뷰 추가 모달 */}
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

  // PC 레이아웃 (2컬럼)
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex">
        {/* 왼쪽: 컨텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {/* 커버 이미지 */}
          {location.imageUrl && !imageError && (
            <div className="relative h-56 bg-gray-100">
              <img
                src={getDetailImageUrl(location.imageUrl)}
                alt={location.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
              />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
              <div className="absolute bottom-4 left-4">
                <span className="px-3 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-lg">
                  {location.categorySub || location.categoryMain || '미분류'}
                </span>
              </div>
            </div>
          )}

          {/* 이미지 없을 때 헤더 */}
          {(!location.imageUrl || imageError) && (
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <span className="px-3 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-lg">
                {location.categorySub || location.categoryMain || '미분류'}
              </span>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>
          )}

          <div className="p-6 space-y-5">
            {/* 헤더 */}
            <div>
              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
                {location.rating > 0 && (
                  <div className="flex items-center gap-1 text-orange-500 flex-shrink-0 ml-3">
                    <Star size={18} className="fill-current" />
                    <span className="font-semibold">{location.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">{location.region}</p>

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

            {/* 큐레이터 원라이너 */}
            {location.short_desc && (
              <div className="bg-orange-50 rounded-2xl p-5">
                <p className="text-xl font-medium text-gray-900 leading-relaxed">
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

            {/* 메모 */}
            {location.memo && location.memo !== location.short_desc && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-600 leading-relaxed">{location.memo}</p>
              </div>
            )}

            {/* 커뮤니티 리뷰 */}
            <CommunityReviews
              reviews={reviews}
              reviewCount={reviewCount}
              isExpanded={isReviewsExpanded}
              onToggle={() => setIsReviewsExpanded(!isReviewsExpanded)}
            />

            {/* 나도 다녀왔어요 */}
            <button
              onClick={() => setIsAddReviewOpen(true)}
              className="w-full py-3.5 bg-white border-2 border-dashed border-gray-300 text-gray-600 font-medium rounded-xl hover:border-orange-400 hover:text-orange-500 transition-colors"
            >
              나도 다녀왔어요
            </button>

            {/* 지도 버튼 (PC) */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleOpenNaver}
                className="flex-1 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Navigation size={18} />
                네이버지도 열기
              </button>
              <button
                onClick={handleOpenKakao}
                className="flex-1 py-3 bg-yellow-400 text-gray-900 font-medium rounded-xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink size={18} />
                카카오맵 열기
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 지도 미리보기 (PC) */}
        <div className="w-80 bg-gray-100 border-l border-gray-200 flex-shrink-0 hidden lg:block">
          <div className="sticky top-0 h-full flex items-center justify-center">
            <div className="text-center p-6">
              <MapPin size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">지도에서 위치 확인</p>
              <p className="text-xs text-gray-400 mt-1">
                {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 리뷰 추가 모달 */}
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
