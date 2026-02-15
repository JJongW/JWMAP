import { Loader2 } from 'lucide-react';
import { PlaceSearch } from '../PlaceSearch';

export interface ExistingLocationSummary {
  id: string;
  name: string;
  address: string;
  kakao_place_id?: string;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lon: number;
  category: string;
}

interface PlaceSearchSectionProps {
  name: string;
  address: string;
  kakaoPlaceId?: string;
  duplicateWarning: ExistingLocationSummary | null;
  isGeocoding: boolean;
  onPlaceSelect: (place: PlaceSearchResult) => void;
  onManualNameChange: (name: string) => void;
  onAddressChange: (address: string) => void | Promise<void>;
}

export function PlaceSearchSection({
  name,
  address,
  kakaoPlaceId,
  duplicateWarning,
  isGeocoding,
  onPlaceSelect,
  onManualNameChange,
  onAddressChange,
}: PlaceSearchSectionProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          장소 검색 <span className="text-red-500">*</span>
        </label>
        <PlaceSearch onSelect={onPlaceSelect} placeholder="장소명으로 검색하세요" />
        {name && !duplicateWarning && (
          <p className="text-xs text-green-600 mt-1.5">
            선택됨: {name}
          </p>
        )}
        {duplicateWarning && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-700 font-medium">이미 등록된 장소입니다</p>
            <p className="text-xs text-amber-600 mt-1">
              "{duplicateWarning.name}" ({duplicateWarning.address})
            </p>
            <p className="text-xs text-amber-500 mt-1">그래도 추가하려면 저장 버튼을 누르세요.</p>
          </div>
        )}
      </div>

      {!kakaoPlaceId && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">또는 직접 입력</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onManualNameChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="장소명"
            />
          </div>
          <div className="relative">
            <input
              type="text"
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="주소"
            />
            {isGeocoding && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 size={16} className="animate-spin text-orange-500" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
