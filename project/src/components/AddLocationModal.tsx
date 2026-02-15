import { X } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { ImageUpload } from './ImageUpload';
import type { Features, Province, CategoryMain, CategorySub, ContentMode } from '../types/location';
import { PROVINCES, getCategoryMainsByMode } from '../types/location';
import { CURATION_LEVELS, isOwnerMode } from '../utils/curation';
import { useAddLocationForm, type AddLocationPayload } from '../hooks/useAddLocationForm';
import { AddLocationActions } from './add-location/AddLocationActions';
import { AiTagSuggestionSection } from './add-location/AiTagSuggestionSection';
import { FeatureTagSection } from './add-location/FeatureTagSection';
import {
  PlaceSearchSection,
  type ExistingLocationSummary,
} from './add-location/PlaceSearchSection';

interface AddLocationModalProps {
  contentMode: ContentMode;
  onClose: () => void;
  onSave: (location: AddLocationPayload) => void;
  existingLocations?: ExistingLocationSummary[];
}

export function AddLocationModal({ contentMode, onClose, onSave, existingLocations = [] }: AddLocationModalProps) {
  const {
    formData,
    setFormData,
    features,
    customTags,
    suggestions,
    duplicateWarning,
    isGeocoding,
    isGeneratingTags,
    availableDistricts,
    availableCategorySubs,
    isFormValid,
    suggestedFeaturesText,
    handleAddressChange,
    handlePlaceSelect,
    handleFeatureToggle,
    handleTagToggle,
    handleGetSuggestions,
    handleSubmit,
  } = useAddLocationForm({ existingLocations, onSave, onClose, contentMode });

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {contentMode === 'space' ? '새 볼거리 장소 추가' : '새로운 장소 추가'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-5 space-y-4">
          <PlaceSearchSection
            name={formData.name}
            address={formData.address}
            kakaoPlaceId={formData.kakao_place_id}
            duplicateWarning={duplicateWarning}
            isGeocoding={isGeocoding}
            onPlaceSelect={handlePlaceSelect}
            onManualNameChange={(name) => setFormData((prev) => ({ ...prev, name }))}
            onAddressChange={handleAddressChange}
          />

          {/* 시/도 선택 */}
          <CustomSelect
            label="시/도"
            required
            value={formData.province}
            onChange={(value) => setFormData((prev) => ({
              ...prev,
              province: value as Province,
              region: '', // Province 변경 시 region 초기화
            }))}
            options={PROVINCES}
            placeholder="시/도를 선택하세요"
          />

          {/* 세부 지역 선택 - Province 선택 후에만 표시 */}
          {formData.province && availableDistricts.length > 0 && (
            <CustomSelect
              label="세부 지역"
              required
              value={formData.region}
              onChange={(value) => setFormData((prev) => ({ ...prev, region: value }))}
              options={availableDistricts}
              placeholder="세부 지역을 선택하세요"
            />
          )}

          {/* 카테고리 대분류 */}
          <CustomSelect
            label="카테고리 (대분류)"
            required
            value={formData.categoryMain}
            onChange={(value) => setFormData((prev) => ({
              ...prev,
              categoryMain: value as CategoryMain,
              categorySub: '', // 대분류 변경 시 소분류 초기화
            }))}
            options={getCategoryMainsByMode(contentMode).filter(main => main !== '전체')}
            placeholder="카테고리 대분류를 선택하세요"
          />

          {/* 카테고리 소분류 - 대분류 선택 후에만 표시 */}
          {formData.categoryMain && formData.categoryMain !== '전체' && availableCategorySubs.length > 0 && (
            <CustomSelect
              label="카테고리 (소분류)"
              required
              value={formData.categorySub}
              onChange={(value) => setFormData((prev) => ({
                ...prev,
                categorySub: value as CategorySub,
              }))}
              options={availableCategorySubs}
              placeholder="카테고리 소분류를 선택하세요"
            />
          )}

          <AiTagSuggestionSection
            shortDesc={formData.short_desc}
            isGeneratingTags={isGeneratingTags}
            suggestions={suggestions}
            selectedTags={customTags}
            suggestedFeaturesText={suggestedFeaturesText}
            onShortDescChange={(value) => setFormData((prev) => ({ ...prev, short_desc: value }))}
            onGenerate={handleGetSuggestions}
            onToggleTag={handleTagToggle}
          />

          <FeatureTagSection
            features={features}
            featureOptions={featureOptions}
            selectedTags={customTags}
            onToggleFeature={handleFeatureToggle}
            onToggleTag={handleTagToggle}
          />

          {/* 이미지 */}
          <ImageUpload
            label="이미지"
            value={formData.imageUrl}
            onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
          />

          {/* 큐레이션 레벨 (주인장만 수정 가능) */}
          {isOwnerMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">큐레이션 레벨</label>
              <div className="grid grid-cols-5 gap-1.5">
                {CURATION_LEVELS.map((tier) => (
                  <button
                    key={tier.level}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, curation_level: tier.level }))}
                    className={`px-2 py-2 text-xs font-medium rounded-lg transition-colors text-center ${
                      formData.curation_level === tier.level
                        ? tier.badgeClass + ' ring-2 ring-offset-1 ring-current'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 주인장 다녀옴 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.curator_visited !== false}
              onChange={(e) => setFormData((prev) => ({ ...prev, curator_visited: e.target.checked }))}
              className="rounded border-gray-300 text-point focus:ring-point"
            />
            <span className="text-sm text-gray-700">주인장이 직접 다녀온 장소</span>
          </label>
        </div>

        <AddLocationActions isFormValid={isFormValid} onCancel={onClose} onSave={handleSubmit} />
      </div>
    </div>
  );
}
