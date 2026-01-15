import { useState, useEffect } from 'react';
import type { Location, Features } from '../types/location';
import { Star, MapPin, Edit2, Trash2, ExternalLink, X, Check, ImageIcon } from 'lucide-react';
import { locationApi } from '../utils/supabase';
import { getCardImageUrl } from '../utils/image';
import { CustomSelect } from './CustomSelect';
import { ImageUpload } from './ImageUpload';

interface LocationCardProps {
  location: Location;
  onDelete: (id: string) => void;
  onUpdate?: (updatedLocation: Location) => void;
}

const featureOptions: { key: keyof Features; label: string }[] = [
  { key: 'solo_ok', label: '혼밥 가능' },
  { key: 'quiet', label: '조용한 분위기' },
  { key: 'wait_short', label: '웨이팅 짧음' },
  { key: 'date_ok', label: '데이트 추천' },
  { key: 'group_ok', label: '단체석 있음' },
  { key: 'parking', label: '주차 가능' },
  { key: 'pet_friendly', label: '반려동물 동반' },
  { key: 'reservation', label: '예약 가능' },
  { key: 'late_night', label: '심야 영업' },
];

export function LocationCard({ location, onDelete, onUpdate }: LocationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRating, setEditedRating] = useState(location.rating);
  const [editedImageUrl, setEditedImageUrl] = useState(location.imageUrl);
  const [editedCategory, setEditedCategory] = useState(location.categorySub || location.categoryMain || '');
  const [editedMemo, setEditedMemo] = useState(location.memo);
  const [editedFeatures, setEditedFeatures] = useState<Features>(location.features || {});
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setEditedRating(location.rating);
    setEditedImageUrl(location.imageUrl);
    setEditedCategory(location.categorySub || location.categoryMain || '');
    setEditedMemo(location.memo);
    setEditedFeatures(location.features || {});
    setImageError(false);
  }, [location]);

  const handleFeatureToggle = (key: keyof Features) => {
    setEditedFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    try {
      // features에서 true인 것만 포함
      const activeFeatures = Object.fromEntries(
        Object.entries(editedFeatures).filter(([, value]) => value === true)
      );
      const updatedData = await locationApi.update(location.id, {
        rating: editedRating,
        imageUrl: editedImageUrl,
        category: editedCategory,
        memo: editedMemo,
        features: Object.keys(activeFeatures).length > 0 ? activeFeatures : {},
      });

      // 부모 컴포넌트에 업데이트 알림
      if (onUpdate) {
        onUpdate(updatedData);
      }

      alert('수정된 내용이 저장되었습니다.');
      setIsEditing(false);
    } catch (error: any) {
      console.error('데이터 저장 오류:', error);
      console.error('오류 상세:', error?.message, error?.details, error?.hint);
      alert(`데이터 저장 중 문제가 발생했습니다.\n${error?.message || error}`);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`${location.name}을(를) 삭제하시겠습니까?`)) {
      return;
    }
    onDelete(location.id);
  };

  /**
   * 카카오맵 앱 딥링크 연결
   * 카카오맵 API를 통해 장소를 검색하고, placeId가 있으면 place 딥링크, 없으면 search 딥링크 사용
   * 앱이 설치되어 있으면 딥링크로, 없으면 웹으로 연결
   */
  const handleKakaoMapSearch = async () => {
    const name = location.name;
    let placeId: string | undefined = undefined;

    const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_RESTFUL_API_KEY || '';

    // API 키가 있으면 카카오맵 API로 장소 검색하여 placeId 획득 시도
    if (KAKAO_API_KEY) {
      try {
        const kakaoSearchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(location.name)}`;

        const response = await fetch(kakaoSearchUrl, {
          headers: {
            Authorization: `KakaoAK ${KAKAO_API_KEY}`,
          },
        });

        // HTTP 응답 상태 확인
        if (response.ok) {
          const data = await response.json();
          const results = data.documents || [];

          if (results.length > 0) {
            // 가장 관련성 높은 결과 선택
            // 카카오맵 API 응답의 id 필드를 placeId로 사용
            placeId = results[0].id;
          }
        } else {
          console.warn(`카카오맵 API 오류 (${response.status}): placeId 없이 검색 딥링크로 연결합니다.`);
        }
      } catch (error) {
        console.error('카카오맵 API 요청 오류:', error);
        // API 오류 시 placeId 없이 진행
      }
    } else {
      console.warn('카카오맵 API 키가 없어 검색 딥링크로 연결합니다.');
    }

    // 1️⃣ 앱 딥링크 생성
    // placeId가 있으면 place 딥링크, 없으면 search 딥링크 사용
    const appLink = placeId
      ? `kakaomap://place?id=${placeId}`
      : `kakaomap://search?q=${encodeURIComponent(name)}`;

    // 2️⃣ 웹 fallback URL
    const webLink = placeId
      ? `https://place.map.kakao.com/${placeId}`
      : `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;

    // 3️⃣ 사용자 클릭 기반 이동 (딥링크 시도)
    window.location.href = appLink;

    // 4️⃣ 앱 미설치 시 fallback (700ms 후 웹으로 이동)
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  };

  /**
   * 네이버 지도 앱 딥링크 연결
   * 네이버 지도 API를 통해 장소를 검색하고, placeId가 있으면 place 딥링크, 없으면 search 딥링크 사용
   * 앱이 설치되어 있으면 딥링크로, 없으면 웹으로 연결
   */
  const handleNaverMapSearch = async () => {
    // appname 파라미터는 필수 (모바일 웹: 웹 페이지 URL 사용)
    const appName = encodeURIComponent(window.location.origin);
    const name = location.name;

    const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_CLIENT_ID || '';
    const NAVER_CLIENT_SECRET = import.meta.env.VITE_NAVER_CLIENT_SECRET || '';

    let placeId: string | undefined = undefined;

    // API 키가 있으면 네이버 지도 API로 장소 검색하여 placeId 획득 시도
    if (NAVER_CLIENT_ID && NAVER_CLIENT_SECRET) {
      try {
        const searchQuery = `${location.name} ${location.address}`.trim();
        const naverSearchUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(searchQuery)}&display=5&sort=random`;

        const response = await fetch(naverSearchUrl, {
          headers: {
            'X-Naver-Client-Id': NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
          },
        });

        // HTTP 응답 상태 확인
        if (response.ok) {
          const data = await response.json();
          const items = data.items || [];

          if (items.length > 0) {
            // 가장 관련성 높은 결과 선택
            // 네이버 지도 API 응답에서 id 또는 link 필드를 placeId로 사용
            const bestMatch = items[0];
            // 네이버 지도 Local Search API 응답의 id 필드를 placeId로 사용
            // 또는 link 필드에서 place ID를 추출할 수 있음
            placeId = bestMatch.id || bestMatch.link?.match(/place\/(\d+)/)?.[1];
          }
        } else {
          console.warn(`네이버 API 오류 (${response.status}): placeId 없이 검색 딥링크로 연결합니다.`);
        }
      } catch (error) {
        console.error('네이버 지도 API 요청 오류:', error);
        // API 오류 시 placeId 없이 진행
      }
    }

    // 1️⃣ 앱 딥링크 생성
    // placeId가 있으면 place 딥링크, 없으면 search 딥링크 사용
    const appLink = placeId
      ? `nmap://place?id=${placeId}&appname=${appName}`
      : `nmap://search?query=${encodeURIComponent(name)}&appname=${appName}`;

    // 2️⃣ 웹 fallback URL
    const webLink = `https://map.naver.com/v5/search/${encodeURIComponent(name)}`;

    // 3️⃣ 사용자 클릭 기반 이동 (딥링크 시도)
    window.location.href = appLink;

    // 4️⃣ 앱 미설치 시 fallback (700ms 후 웹으로 이동)
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  };

  // 카테고리 표시용 헬퍼 함수 (categorySub 우선, 없으면 category)
  const getDisplayCategory = (loc: Location): string => {
    return loc.categorySub || loc.category || '미분류';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* 이미지 영역 */}
      <div className="relative h-48 bg-gray-100">
        {editedImageUrl && !imageError ? (
          <img
            src={getCardImageUrl(editedImageUrl)}
            alt={location.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {/* 카테고리 배지 */}
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white">
            {location.categorySub || editedCategory}
          </span>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="p-5 space-y-4">
        {/* 제목 & 평점 */}
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-gray-900">{location.name}</h3>
          <div className="flex items-center gap-1 text-orange-500">
            <Star size={16} className="fill-current" />
            {isEditing ? (
              <input
                type="number"
                value={editedRating}
                step="0.1"
                min="0"
                max="5"
                onChange={(e) => setEditedRating(parseFloat(e.target.value))}
                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-700"
              />
            ) : (
              <span className="text-sm font-semibold">{editedRating?.toFixed(1) || '0.0'}</span>
            )}
          </div>
        </div>

        {/* 주소 */}
        <p className="text-gray-500 text-sm flex items-center gap-1.5">
          <MapPin size={14} className="text-gray-400" />
          {location.address}
        </p>

        {/* 메모 */}
        {isEditing ? (
          <textarea
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="메모를 입력하세요"
            rows={3}
          />
        ) : (
          <p className="text-gray-600 text-sm bg-gray-50 rounded-xl p-3">
            {location.memo || '메모가 없습니다.'}
          </p>
        )}

        {/* 카테고리 선택 (수정 모드) - 레거시 호환을 위해 category 필드만 수정 */}
        {isEditing && (
          <CustomSelect
            label="종류"
            value={editedCategory}
            onChange={(value) => setEditedCategory(value as Location['category'])}
            options={[
              '한식', '중식', '일식', '라멘', '양식', '분식', '호프집', '칵테일바',
              '와인바', '아시안', '돈까스', '회', '피자', '베이커리', '카페', '카공카페', '버거',
            ]}
            placeholder="종류를 선택하세요"
          />
        )}

        {/* 이미지 업로드 (수정 모드) */}
        {isEditing && (
          <ImageUpload
            label="이미지"
            value={editedImageUrl}
            onChange={(url) => setEditedImageUrl(url)}
          />
        )}

        {/* 특징 (수정 모드) */}
        {isEditing && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">특징</label>
            <div className="flex flex-wrap gap-1.5">
              {featureOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleFeatureToggle(option.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    editedFeatures[option.key]
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 특징 표시 (보기 모드) */}
        {!isEditing && location.features && Object.keys(location.features).some(k => location.features?.[k as keyof Features]) && (
          <div className="flex flex-wrap gap-1.5">
            {featureOptions
              .filter((option) => location.features?.[option.key])
              .map((option) => (
                <span
                  key={option.key}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700"
                >
                  {option.label}
                </span>
              ))}
          </div>
        )}

        {/* 태그 표시 (보기 모드) */}
        {!isEditing && location.tags && location.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {location.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 버튼 그룹 */}
        <div className="flex gap-2 pt-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <X size={16} />
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                저장
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 px-3 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 size={15} />
                수정
              </button>
              <button
                onClick={handleKakaoMapSearch}
                className="flex-1 px-2.5 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5"
                title="카카오맵에서 보기"
              >
                <ExternalLink size={15} />
                <span className="hidden sm:inline">카카오</span>
              </button>
              <button
                onClick={handleNaverMapSearch}
                className="flex-1 px-2.5 py-2.5 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-1.5"
                title="네이버 지도에서 보기"
              >
                <ExternalLink size={15} />
                <span className="hidden sm:inline">네이버</span>
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-2.5 bg-red-50 text-red-500 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center"
                title="삭제"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
