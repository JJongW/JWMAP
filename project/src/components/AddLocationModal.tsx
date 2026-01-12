import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { ImageUpload } from './ImageUpload';
import { PlaceSearch } from './PlaceSearch';
import type { Features } from '../types/location';
import type { LLMSuggestions, TagSuggestion } from '../schemas/llmSuggestions';
import { featureLabels, tagTypeLabels } from '../schemas/llmSuggestions';

interface AddLocationModalProps {
  onClose: () => void;
  onSave: (location: {
    name: string;
    region: string;
    category: string;
    address: string;
    imageUrl: string;
    rating: number;
    lon: number;
    lat: number;
    memo: string;
    short_desc?: string;
    kakao_place_id?: string;
    features?: Features;
  }) => void;
}

export function AddLocationModal({ onClose, onSave }: AddLocationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    category: '',
    address: '',
    imageUrl: '',
    rating: 0,
    lon: 0,
    lat: 0,
    memo: '',
    short_desc: '',
    kakao_place_id: '',
  });
  const [features, setFeatures] = useState<Features>({});
  const [showOptional, setShowOptional] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [suggestions, setSuggestions] = useState<LLMSuggestions | null>(null);

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

  const regions = [
    '강남', '서초', '잠실/송파/강동', '영등포/여의도/강서', '건대/성수/왕십리',
    '종로/중구', '홍대/합정/마포/연남', '용산/이태원/한남', '성북/노원/중랑',
    '구로/관악/동작', '신촌/연희', '창동/도봉산', '회기/청량리', '강동/고덕',
    '연신내/구파발', '마곡/김포', '미아/수유/북한산', '목동/양천', '금천/가산'
  ];

  const categories = [
    '한식', '중식', '일식', '라멘', '양식', '분식', '호프집', '칵테일바',
    '와인바', '아시안', '돈까스', '회', '피자', '베이커리', '카페', '카공카페', '버거',
    '프랑스음식', '고기요리', '퓨전음식', '베트남'
  ];

  // 주소에서 지역 자동 추출
  const extractRegionFromAddress = (address: string): string => {
    const regionMap: Record<string, string> = {
      '강남구': '강남',
      '서초구': '서초',
      '송파구': '잠실/송파/강동',
      '강동구': '잠실/송파/강동',
      '영등포구': '영등포/여의도/강서',
      '여의도': '영등포/여의도/강서',
      '강서구': '영등포/여의도/강서',
      '광진구': '건대/성수/왕십리',
      '성동구': '건대/성수/왕십리',
      '종로구': '종로/중구',
      '중구': '종로/중구',
      '마포구': '홍대/합정/마포/연남',
      '용산구': '용산/이태원/한남',
      '성북구': '성북/노원/중랑',
      '노원구': '성북/노원/중랑',
      '중랑구': '성북/노원/중랑',
      '구로구': '구로/관악/동작',
      '관악구': '구로/관악/동작',
      '동작구': '구로/관악/동작',
      '서대문구': '신촌/연희',
      '도봉구': '창동/도봉산',
      '동대문구': '회기/청량리',
      '은평구': '연신내/구파발',
      '강북구': '미아/수유/북한산',
      '양천구': '목동/양천',
      '금천구': '금천/가산',
    };

    for (const [key, value] of Object.entries(regionMap)) {
      if (address.includes(key)) {
        return value;
      }
    }
    return '';
  };

  // 카카오 카테고리에서 우리 카테고리로 매핑
  const mapCategory = (kakaoCategory: string): string => {
    const categoryMap: Record<string, string> = {
      '한식': '한식',
      '중식': '중식',
      '일식': '일식',
      '양식': '양식',
      '분식': '분식',
      '카페': '카페',
      '베이커리': '베이커리',
      '술집': '호프집',
      '호프': '호프집',
      '이자카야': '일식',
      '라멘': '라멘',
      '돈카츠': '돈까스',
      '돈까스': '돈까스',
      '초밥': '일식',
      '횟집': '회',
      '피자': '피자',
      '햄버거': '버거',
      '버거': '버거',
      '베트남': '베트남',
      '태국': '아시안',
      '인도': '아시안',
    };

    const lower = kakaoCategory.toLowerCase();
    for (const [key, value] of Object.entries(categoryMap)) {
      if (lower.includes(key.toLowerCase())) {
        return value;
      }
    }
    return '';
  };

  // 장소 선택 핸들러
  const handlePlaceSelect = (place: {
    id: string;
    name: string;
    address: string;
    roadAddress: string;
    lat: number;
    lon: number;
    category: string;
  }) => {
    const detectedRegion = extractRegionFromAddress(place.roadAddress || place.address);
    const mappedCategory = mapCategory(place.category);

    setFormData((prev) => ({
      ...prev,
      name: place.name,
      address: place.roadAddress || place.address,
      lat: place.lat,
      lon: place.lon,
      kakao_place_id: place.id,
      region: detectedRegion || prev.region,
      category: mappedCategory || prev.category,
    }));
  };

  const handleFeatureToggle = (key: keyof Features) => {
    setFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // LLM 태그 제안 요청
  const handleGetSuggestions = async () => {
    if (!formData.short_desc.trim()) return;

    setIsGeneratingTags(true);
    setSuggestions(null);

    try {
      const response = await fetch('/api/suggest-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeName: formData.name,
          category: formData.category,
          experience: formData.short_desc,
        }),
      });

      if (response.ok) {
        const data = await response.json() as LLMSuggestions;
        setSuggestions(data);

        // 제안된 features 자동 적용
        if (data.features) {
          setFeatures((prev) => ({ ...prev, ...data.features }));
        }
      }
    } catch (error) {
      console.error('Tag suggestion error:', error);
    } finally {
      setIsGeneratingTags(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.region || !formData.category) {
      alert('장소명, 지역, 종류는 필수 항목입니다.');
      return;
    }

    // features에서 true인 것만 포함
    const activeFeatures = Object.fromEntries(
      Object.entries(features).filter(([, value]) => value === true)
    );

    onSave({
      ...formData,
      features: Object.keys(activeFeatures).length > 0 ? activeFeatures : undefined,
    });
    onClose();
  };

  const isFormValid = formData.name && formData.region && formData.category;

  // 추천된 features 라벨 표시
  const getSuggestedFeaturesText = (): string => {
    if (!suggestions?.features) return '';
    const activeKeys = Object.entries(suggestions.features)
      .filter(([, v]) => v)
      .map(([k]) => featureLabels[k as keyof typeof featureLabels])
      .filter(Boolean);
    return activeKeys.join(', ');
  };

  // 추천된 tags 표시
  const renderSuggestedTags = () => {
    if (!suggestions?.tags || suggestions.tags.length === 0) return null;

    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.tags.map((tag: TagSuggestion, idx: number) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 text-xs rounded-md"
            title={`${tagTypeLabels[tag.type]} (확신도: ${Math.round(tag.weight * 100)}%)`}
          >
            <span className="text-orange-400">{tagTypeLabels[tag.type]}</span>
            {tag.name}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">새로운 장소 추가</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-5 space-y-4">
          {/* 장소 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              장소 검색 <span className="text-red-500">*</span>
            </label>
            <PlaceSearch onSelect={handlePlaceSelect} placeholder="장소명으로 검색하세요" />
            {formData.name && (
              <p className="text-xs text-green-600 mt-1.5">
                선택됨: {formData.name}
              </p>
            )}
          </div>

          {/* 직접 입력 옵션 */}
          {!formData.kakao_place_id && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  또는 직접 입력
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="장소명"
                />
              </div>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => {
                  const address = e.target.value;
                  const detectedRegion = extractRegionFromAddress(address);
                  setFormData((prev) => ({
                    ...prev,
                    address,
                    region: detectedRegion || prev.region,
                  }));
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="주소"
              />
            </div>
          )}

          {/* 지역 */}
          <CustomSelect
            label="지역"
            required
            value={formData.region}
            onChange={(value) => setFormData((prev) => ({ ...prev, region: value }))}
            options={regions}
            placeholder="지역을 선택하세요"
          />

          {/* 종류 */}
          <CustomSelect
            label="종류"
            required
            value={formData.category}
            onChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
            options={categories}
            placeholder="종류를 선택하세요"
          />

          {/* 한 줄 경험 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              이곳은 어땠나요?
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.short_desc}
                onChange={(e) => setFormData((prev) => ({ ...prev, short_desc: e.target.value }))}
                className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="예: 혼자 가기 좋고 웨이팅 없어서 편해요"
              />
              {formData.short_desc.trim() && (
                <button
                  type="button"
                  onClick={handleGetSuggestions}
                  disabled={isGeneratingTags}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                  title="AI 태그 추천"
                >
                  {isGeneratingTags ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                </button>
              )}
            </div>
            {suggestions && (
              <div className="mt-2">
                {getSuggestedFeaturesText() && (
                  <p className="text-xs text-orange-500">
                    AI 추천 특징: {getSuggestedFeaturesText()}
                  </p>
                )}
                {renderSuggestedTags()}
                {suggestions.confidence > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    확신도: {Math.round(suggestions.confidence * 100)}%
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 특징 (Features) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">특징</label>
            <div className="flex flex-wrap gap-2">
              {featureOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleFeatureToggle(option.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    features[option.key]
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 선택 입력 섹션 토글 */}
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span>추가 정보 입력 (선택)</span>
            {showOptional ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {/* 선택 입력 섹션 */}
          {showOptional && (
            <div className="space-y-4 pt-2">
              {/* 이미지 */}
              <ImageUpload
                label="이미지"
                value={formData.imageUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
              />

              {/* 평점 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">평점</label>
                <input
                  type="number"
                  value={formData.rating || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rating: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="0.0 ~ 5.0"
                />
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">메모</label>
                <textarea
                  value={formData.memo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  placeholder="상세한 메모를 남겨보세요"
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
              isFormValid
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
