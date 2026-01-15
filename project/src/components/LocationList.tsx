import { MapPin, Star } from 'lucide-react';
import type { Location, Province } from '../types/location';
import { inferProvinceFromRegion } from '../types/location';
import { getThumbnailUrl, getCardImageUrl } from '../utils/image';

interface LocationListProps {
  locations: Location[];
  visibleCount: number;
  onShowMore: () => void;
  onSelect: (location: Location) => void;
  onHover?: (locationId: string | null) => void;
  selectedId?: string;
  hoveredId?: string;
  variant?: 'card' | 'compact';
  showHeader?: boolean;
  headerLabel?: string;
  isSearchMode?: boolean;
}

// Helper function to get province
const getLocationProvince = (location: Location): Province | null => {
  if (location.province) return location.province;
  return inferProvinceFromRegion(location.region);
};

export function LocationList({
  locations,
  visibleCount,
  onShowMore,
  onSelect,
  onHover,
  selectedId,
  hoveredId,
  variant = 'card',
  showHeader = true,
  headerLabel = '장소 목록',
  isSearchMode = false,
}: LocationListProps) {
  if (variant === 'compact') {
    // Compact variant for bottom sheet
    return (
      <div className="divide-y divide-gray-100">
        {locations.slice(0, visibleCount).map(location => (
          <div
            key={location.id}
            onClick={() => onSelect(location)}
            onMouseEnter={() => onHover?.(location.id)}
            onMouseLeave={() => onHover?.(null)}
            className={`px-4 py-3 cursor-pointer transition-colors ${
              selectedId === location.id
                ? 'bg-orange-50'
                : hoveredId === location.id
                ? 'bg-gray-50'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex gap-3">
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {location.imageUrl ? (
                  <img
                    src={getThumbnailUrl(location.imageUrl)}
                    alt={location.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin size={20} className="text-gray-300" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 truncate">{location.name}</h3>
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded flex-shrink-0">
                    {location.categorySub || location.categoryMain || '미분류'}
                  </span>
                  {/* Event Tags */}
                  {location.eventTags && location.eventTags.length > 0 && (
                    <>
                      {location.eventTags.map((eventTag, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 bg-black text-white text-xs font-medium rounded flex-shrink-0"
                        >
                          {eventTag}
                        </span>
                      ))}
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {getLocationProvince(location)
                    ? `${getLocationProvince(location)} · ${location.region}`
                    : location.region}
                </p>
                {location.short_desc && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    "{location.short_desc}"
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-1 text-orange-500">
                    <Star size={12} className="fill-current" />
                    <span className="text-xs font-semibold">
                      {location.rating?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                  {/* Feature chips */}
                  {location.tags && location.tags.length > 0 && (
                    <div className="flex gap-1">
                      {location.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Show More */}
        {visibleCount < locations.length && (
          <div className="py-4 text-center">
            <button
              onClick={onShowMore}
              className="px-6 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              더 보기 ({locations.length - visibleCount}개 더)
            </button>
          </div>
        )}
      </div>
    );
  }

  // Card variant (default) - for Browse mode and Desktop sidebar
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4" data-location-list>
      {showHeader && (
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {headerLabel} <span className="text-orange-500">({locations.length})</span>
          {isSearchMode && (
            <span className="ml-2 text-blue-500 text-xs font-normal">- 검색 결과</span>
          )}
        </h2>
      )}

      {locations.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {locations.slice(0, visibleCount).map(location => (
            <div
              key={location.id}
              onClick={() => onSelect(location)}
              onMouseEnter={() => onHover?.(location.id)}
              onMouseLeave={() => onHover?.(null)}
              className={`rounded-2xl cursor-pointer transition-all overflow-hidden ${
                selectedId === location.id
                  ? 'ring-2 ring-orange-400 shadow-lg'
                  : hoveredId === location.id
                  ? 'shadow-md border border-gray-200'
                  : 'hover:shadow-md border border-gray-100'
              }`}
            >
              {/* Image */}
              <div className="relative h-32 bg-gray-100">
                {location.imageUrl ? (
                  <img
                    src={getCardImageUrl(location.imageUrl)}
                    alt={location.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded-lg">
                    {location.categorySub || location.categoryMain || '미분류'}
                  </span>
                  {/* Event Tags */}
                  {location.eventTags && location.eventTags.length > 0 && (
                    <>
                      {location.eventTags.map((eventTag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-black text-white text-xs font-medium rounded-lg"
                        >
                          {eventTag}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-3">
                <h3 className="font-semibold text-gray-900 truncate">{location.name}</h3>
                {location.short_desc && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                    "{location.short_desc}"
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500 truncate flex-1">
                    {getLocationProvince(location)
                      ? `${getLocationProvince(location)} · ${location.region}`
                      : location.region}
                  </p>
                  <div className="flex items-center gap-1 text-orange-500">
                    <Star size={12} className="fill-current" />
                    <span className="text-xs font-semibold">
                      {location.rating?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-center py-8">조건에 맞는 장소가 없습니다.</div>
      )}

      {visibleCount < locations.length && (
        <div className="text-center mt-6">
          <button
            onClick={onShowMore}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
