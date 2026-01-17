import { ArrowLeft, Star, MapPin, Navigation, ExternalLink, ChevronRight, Share2 } from 'lucide-react';
import type { Location, Province, Features } from '../types/location';
import { inferProvinceFromRegion } from '../types/location';
import { getCardImageUrl } from '../utils/image';
import { clickLogApi } from '../utils/supabase';
import { shareToKakao } from '../utils/kakaoShare';

interface PlacePreviewProps {
  location: Location;
  onBack?: () => void;
  onOpenDetail: () => void;
  className?: string;
  searchId?: string | null;
}

// Feature labels
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

const getLocationProvince = (location: Location): Province | null => {
  if (location.province) return location.province;
  return inferProvinceFromRegion(location.region);
};

export function PlacePreview({
  location,
  onBack,
  onOpenDetail,
  className = '',
  searchId,
}: PlacePreviewProps) {
  // Get active features
  const activeFeatures = location.features
    ? Object.entries(location.features)
        .filter(([, value]) => value)
        .map(([key]) => ({
          key: key as keyof Features,
          label: featureLabels[key as keyof Features],
        }))
        .slice(0, 4)
    : [];

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

  // 카카오톡 공유
  const handleShareKakao = () => {
    shareToKakao(location);
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header with back button */}
      {onBack && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-base">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-base transition-colors"
            >
              <ArrowLeft size={20} className="text-accent/80" />
            </button>
            <span className="text-sm text-accent/70">
              {location.categorySub || location.categoryMain || '미분류'}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-none">
        {/* Image (if available) */}
        {location.imageUrl && (
          <div className="h-32 bg-base">
            <img
              src={getCardImageUrl(location.imageUrl)}
              alt={location.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Title & Rating */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-accent">{location.name}</h2>
              <p className="text-sm text-accent/70 mt-0.5">
                {getLocationProvince(location)
                  ? `${getLocationProvince(location)} · ${location.region}`
                  : location.region}
              </p>
            </div>
            {location.rating > 0 && (
              <div className="flex items-center gap-1 text-point flex-shrink-0">
                <Star size={16} className="fill-current" />
                <span className="font-semibold">{location.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* One-liner (highlighted) */}
          {location.short_desc && (
            <div className="bg-[#FF8A3D] rounded-xl p-3">
              <p className="text-sm font-medium text-[#FFF7ED]">"{location.short_desc}"</p>
            </div>
          )}

          {/* Feature chips */}
          {activeFeatures.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFeatures.map(({ key, label }) => (
                <span
                  key={key}
                  className="px-2 py-1 bg-base text-accent/80 text-xs font-medium rounded-lg"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {location.tags && location.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {location.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* View Detail Button */}
          <button
            onClick={onOpenDetail}
            className="w-full flex items-center justify-between px-4 py-3 bg-base rounded-xl hover:bg-opacity-80 transition-colors"
          >
            <span className="text-sm font-medium text-accent">상세 정보 보기</span>
            <ChevronRight size={18} className="text-accent/50" />
          </button>
        </div>
      </div>

      {/* Sticky CTA Row */}
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
    </div>
  );
}
