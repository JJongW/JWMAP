import { useState, useEffect } from 'react';
import type { Location, CategoryMain, CategorySub } from '../types/location';
import { CATEGORY_MAINS, getCategorySubsByMain } from '../types/location';
import { MapPin, Edit2, Trash2, ExternalLink, X, Check, ImageIcon } from 'lucide-react';
import { locationApi } from '../utils/supabase';
import { getCurationLabel, getCurationBadgeClass, ratingToCurationLevel, CURATION_LEVELS, isOwnerMode } from '../utils/curation';
import { getCardImageUrl } from '../utils/image';
import { CustomSelect } from './CustomSelect';
import { ImageUpload } from './ImageUpload';

interface LocationCardProps {
  location: Location;
  onDelete: (id: string) => void;
  onUpdate?: (updatedLocation: Location) => void;
  initialEditing?: boolean; // 초기 편집 모드로 시작할지 여부
}

const QUICK_TAGS = ['벚꽃', '데이트', '혼밥', '조용한 분위기', '웨이팅 적음', '가성비', '브런치', '전시', '산책', '야경'];

export function LocationCard({ location, onDelete, onUpdate, initialEditing = false }: LocationCardProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [editedCurationLevel, setEditedCurationLevel] = useState(
    location.curation_level ?? ratingToCurationLevel(location.rating ?? 0)
  );
  const [editedCuratorVisited, setEditedCuratorVisited] = useState(location.curator_visited !== false);
  const [editedImageUrl, setEditedImageUrl] = useState(location.imageUrl);
  const [editedCategoryMain, setEditedCategoryMain] = useState<CategoryMain | ''>(location.categoryMain || '');
  const [editedCategorySub, setEditedCategorySub] = useState<CategorySub | ''>(location.categorySub || '');
  const [editedMemo, setEditedMemo] = useState(location.memo);
  const [editedTags, setEditedTags] = useState<string[]>(location.tags || []);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // initialEditing이 true인 경우 편집 모드 유지, false인 경우에만 편집 모드 해제
    if (!initialEditing) {
      setIsEditing(false);
    }
    setEditedCurationLevel(location.curation_level ?? ratingToCurationLevel(location.rating ?? 0));
    setEditedCuratorVisited(location.curator_visited !== false);
    setEditedImageUrl(location.imageUrl);
    setEditedCategoryMain(location.categoryMain || '');
    setEditedCategorySub(location.categorySub || '');
    setEditedMemo(location.memo);
    setEditedTags(location.tags || []);
    setImageError(false);
  }, [location, initialEditing]);

  const visibleTags = [...new Set([...(location.tags || []), ...(location.eventTags || [])])];
  
  // 대분류에 따른 소분류 목록
  const availableCategorySubs = editedCategoryMain && editedCategoryMain !== '전체'
    ? getCategorySubsByMain(editedCategoryMain)
    : [];

  const handleTagToggle = (tag: string) => {
    setEditedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const handleSave = async () => {
    try {
      const updatedData = await locationApi.update(location.id, {
        curation_level: editedCurationLevel,
        curator_visited: editedCuratorVisited,
        imageUrl: editedImageUrl,
        categoryMain: editedCategoryMain || undefined,
        categorySub: editedCategorySub || undefined,
        memo: editedMemo,
        tags: editedTags,
      });

      // 부모 컴포넌트에 업데이트 알림
      if (onUpdate) {
        onUpdate(updatedData);
      }

      alert('수정된 내용이 저장되었습니다.');
      setIsEditing(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('데이터 저장 오류:', error);
      alert(`데이터 저장 중 문제가 발생했습니다.\n${message}`);
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


  return (
    <div className="bg-white rounded-2xl border border-base overflow-hidden">
      {/* 이미지 영역 */}
      <div className="relative h-48 bg-base">
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
            <ImageIcon className="w-12 h-12 text-accent/30" />
          </div>
        )}
        {/* 카테고리 배지 */}
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-point text-white">
            {isEditing ? (editedCategorySub || editedCategoryMain || '미분류') : (location.categorySub || location.categoryMain || '미분류')}
          </span>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="p-5 space-y-4">
        {/* 제목 & 쩝쩝박사 라벨 (주인장만 수정 가능) */}
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-accent">{location.name}</h3>
          {isEditing && isOwnerMode ? (
            <div className="flex gap-1">
              {CURATION_LEVELS.map((tier) => (
                <button
                  key={tier.level}
                  type="button"
                  onClick={() => setEditedCurationLevel(tier.level)}
                  className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                    editedCurationLevel === tier.level
                      ? tier.badgeClass + ' ring-2 ring-offset-1 ring-current'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          ) : (
            <span className={`px-2.5 py-1 text-sm font-medium rounded-lg ${getCurationBadgeClass(location.curation_level ?? ratingToCurationLevel(location.rating ?? 0))}`}>
              {getCurationLabel(location.curation_level ?? ratingToCurationLevel(location.rating ?? 0))}
            </span>
          )}
        </div>

        {/* 주인장 다녀옴 (편집 모드) */}
        {isEditing && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editedCuratorVisited}
              onChange={(e) => setEditedCuratorVisited(e.target.checked)}
              className="rounded border-gray-300 text-point focus:ring-point"
            />
            <span className="text-sm text-accent/80">주인장 다녀옴</span>
          </label>
        )}

        {/* 주소 */}
        <p className="text-accent/70 text-sm flex items-center gap-1.5">
          <MapPin size={14} className="text-accent/50" />
          {location.address}
        </p>

        {/* 메모 */}
        {isEditing ? (
          <textarea
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
            className="w-full border border-base rounded-xl px-3 py-2 text-sm text-accent resize-none focus:outline-none focus:ring-2 focus:ring-point focus:border-transparent"
            placeholder="메모를 입력하세요"
            rows={3}
          />
        ) : (
          <p className="text-accent/80 text-sm bg-base rounded-xl p-3">
            {location.memo || '메모가 없습니다.'}
          </p>
        )}

        {/* 카테고리 선택 (수정 모드) */}
        {isEditing && (
          <>
            <CustomSelect
              label="카테고리 (대분류)"
              value={editedCategoryMain}
              onChange={(value) => {
                setEditedCategoryMain(value as CategoryMain);
                setEditedCategorySub(''); // 대분류 변경 시 소분류 초기화
              }}
              options={CATEGORY_MAINS.filter(main => main !== '전체')}
              placeholder="카테고리 대분류를 선택하세요"
            />
            {editedCategoryMain && editedCategoryMain !== '전체' && availableCategorySubs.length > 0 && (
              <CustomSelect
                label="카테고리 (소분류)"
                value={editedCategorySub}
                onChange={(value) => setEditedCategorySub(value as CategorySub)}
                options={availableCategorySubs}
                placeholder="카테고리 소분류를 선택하세요"
              />
            )}
          </>
        )}

        {/* 이미지 업로드 (수정 모드) */}
        {isEditing && (
          <ImageUpload
            label="이미지"
            value={editedImageUrl}
            onChange={(url) => setEditedImageUrl(url)}
          />
        )}

        {/* 태그 (수정 모드) */}
        {isEditing && (
          <div>
            <label className="text-xs font-medium text-accent/70 mb-2 block">태그</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    editedTags.includes(tag)
                      ? 'bg-point text-white'
                      : 'bg-base text-accent/80 hover:bg-opacity-80'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 태그 표시 (보기 모드) */}
        {!isEditing && visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map((tag, idx) => (
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
                className="flex-1 px-4 py-2.5 bg-base text-accent/80 text-sm font-medium rounded-xl hover:bg-opacity-80 transition-colors flex items-center justify-center gap-1.5"
              >
                <X size={16} />
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-point text-white text-sm font-medium rounded-xl hover:bg-point-hover transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                저장
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 px-3 py-2.5 bg-base text-accent/80 text-sm font-medium rounded-xl hover:bg-opacity-80 transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 size={15} />
                수정
              </button>
              <button
                onClick={handleKakaoMapSearch}
                className="flex-1 px-2.5 py-2.5 bg-point text-white text-sm font-medium rounded-xl hover:bg-point-hover transition-colors flex items-center justify-center gap-1.5"
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
