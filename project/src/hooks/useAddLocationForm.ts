import { useState } from 'react';
import type { Province, CategoryMain, CategorySub, ContentMode } from '../types/location';
import { REGION_HIERARCHY, getCategorySubsByMain } from '../types/location';
import { extractRegionFromAddress } from '../utils/regionMapper';
import { mapKakaoCategoryToOurs } from '../utils/categoryMapper';
import { validateTags } from '../utils/tagValidation';
import { useGeocoding } from './useGeocoding';
import { useTagSuggestions } from './useTagSuggestions';
import type {
  ExistingLocationSummary,
  PlaceSearchResult,
} from '../components/add-location/PlaceSearchSection';

export interface AddLocationPayload {
  name: string;
  province?: Province;
  region: string;
  categoryMain?: CategoryMain;
  categorySub?: CategorySub;
  address: string;
  imageUrl: string;
  rating: number;
  curation_level?: number;
  curator_visited?: boolean;
  lon: number;
  lat: number;
  memo: string;
  short_desc?: string;
  kakao_place_id?: string;
  tags?: string[];
  contentType?: ContentMode;
}

interface UseAddLocationFormParams {
  existingLocations: ExistingLocationSummary[];
  onSave: (location: AddLocationPayload) => void;
  onClose: () => void;
  contentMode: ContentMode;
}

export function useAddLocationForm({ existingLocations, onSave, onClose, contentMode }: UseAddLocationFormParams) {
  const [formData, setFormData] = useState({
    name: '',
    province: '' as Province | '',
    region: '',
    categoryMain: '' as CategoryMain | '',
    categorySub: '' as CategorySub | '',
    address: '',
    imageUrl: '',
    rating: 0,
    curation_level: 2,
    curator_visited: true,
    lon: 0,
    lat: 0,
    memo: '',
    short_desc: '',
    kakao_place_id: '',
    contentType: contentMode,
  });
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<ExistingLocationSummary | null>(null);
  const { isGeocoding, geocodeWithLoading } = useGeocoding();
  const { isGeneratingTags, suggestions, requestSuggestions } = useTagSuggestions();

  const availableDistricts = formData.province ? REGION_HIERARCHY[formData.province] || [] : [];
  const availableCategorySubs = formData.categoryMain && formData.categoryMain !== '전체'
    ? getCategorySubsByMain(formData.categoryMain, contentMode)
    : [];

  const isFormValid = !!(
    formData.name &&
    formData.province &&
    formData.region &&
    formData.categoryMain &&
    formData.address.trim() &&
    (formData.categoryMain === '전체' || availableCategorySubs.length === 0 || formData.categorySub)
  );

  const checkDuplicate = (name: string, address: string, kakaoPlaceId?: string): ExistingLocationSummary | null => {
    if (kakaoPlaceId) {
      const byPlaceId = existingLocations.find((loc) => loc.kakao_place_id === kakaoPlaceId);
      if (byPlaceId) return byPlaceId;
    }

    const normalizedName = name.trim().toLowerCase();
    const normalizedAddress = address.trim().toLowerCase();

    return existingLocations.find((loc) => {
      const locName = loc.name.trim().toLowerCase();
      const locAddress = loc.address.trim().toLowerCase();
      const nameMatch = locName === normalizedName || locName.includes(normalizedName) || normalizedName.includes(locName);
      const addressMatch = locAddress === normalizedAddress || locAddress.includes(normalizedAddress) || normalizedAddress.includes(locAddress);
      return nameMatch && addressMatch;
    }) || null;
  };

  const handleAddressChange = async (address: string) => {
    const detected = extractRegionFromAddress(address);
    setFormData((prev) => ({
      ...prev,
      address,
      province: detected?.province || prev.province,
      region: detected?.region || prev.region,
    }));

    if (address.trim().length > 5 && !formData.kakao_place_id) {
      const coords = await geocodeWithLoading(address);
      if (coords) {
        setFormData((prev) => ({ ...prev, lat: coords.lat, lon: coords.lon }));
      }
    }
  };

  const handlePlaceSelect = (place: PlaceSearchResult) => {
    const detected = extractRegionFromAddress(place.roadAddress || place.address);
    const mappedCategory = mapKakaoCategoryToOurs(place.category);
    const addressToUse = place.roadAddress || place.address;
    setDuplicateWarning(checkDuplicate(place.name, addressToUse, place.id));

    setFormData((prev) => ({
      ...prev,
      name: place.name,
      address: addressToUse,
      lat: place.lat,
      lon: place.lon,
      kakao_place_id: place.id,
      province: detected?.province || prev.province,
      region: detected?.region || prev.region,
      categoryMain: mappedCategory.categoryMain || prev.categoryMain,
      categorySub: mappedCategory.categorySub || prev.categorySub,
    }));
  };

  const handleTagToggle = (tagName: string) => {
    setCustomTags((prev) => (prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]));
  };

  const handleGetSuggestions = async () => {
    const result = await requestSuggestions({
      placeName: formData.name,
      category: formData.categorySub || formData.categoryMain || '',
      experience: formData.short_desc,
    });
    if (result.suggestions?.tags?.length) {
      const suggestedTagNames = result.suggestions.tags.map((tag) => tag.name);
      const merged = validateTags([...customTags, ...suggestedTagNames], { max: 15 }).validTags;
      setCustomTags(merged);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.province || !formData.region || !formData.categoryMain) {
      alert('장소명, 시/도, 세부 지역, 카테고리 대분류는 필수 항목입니다.');
      return;
    }
    if (formData.categoryMain !== '전체' && availableCategorySubs.length > 0 && !formData.categorySub) {
      alert('카테고리 소분류를 선택해주세요.');
      return;
    }
    if (!formData.address.trim()) {
      alert('주소는 필수 항목입니다.');
      return;
    }

    const duplicate = checkDuplicate(formData.name, formData.address, formData.kakao_place_id);
    if (duplicate) {
      const confirmAdd = window.confirm(`"${duplicate.name}"이(가) 이미 등록되어 있습니다.\n그래도 추가하시겠습니까?`);
      if (!confirmAdd) return;
    }

    let finalLat = formData.lat;
    let finalLon = formData.lon;
    if ((!finalLat || !finalLon || finalLat === 0 || finalLon === 0) && formData.address.trim()) {
      const coords = await geocodeWithLoading(formData.address);
      if (!coords) {
        alert('주소를 좌표로 변환할 수 없습니다. 주소를 확인해주세요.');
        return;
      }
      finalLat = coords.lat;
      finalLon = coords.lon;
    }
    if (!finalLat || !finalLon || finalLat === 0 || finalLon === 0) {
      alert('주소의 좌표를 가져올 수 없습니다. 주소를 확인해주세요.');
      return;
    }

    const mergedTags = [...customTags];
    const { validTags, invalidTags } = validateTags(mergedTags, { max: 12 });

    if (invalidTags.length > 0) {
      alert(`다음 태그는 형식 검증에서 제외되었습니다: ${invalidTags.join(', ')}`);
    }
    if (validTags.length === 0) {
      const confirmWithoutTags = window.confirm('저장 가능한 태그가 없습니다. 태그 없이 저장할까요?');
      if (!confirmWithoutTags) return;
    }

    onSave({
      ...formData,
      province: formData.province as Province,
      categoryMain: formData.categoryMain as CategoryMain,
      categorySub: formData.categorySub || undefined,
      memo: formData.short_desc || formData.memo,
      lat: finalLat,
      lon: finalLon,
      curation_level: formData.curation_level,
      tags: validTags.length > 0 ? validTags : undefined,
    });
    onClose();
  };

  return {
    formData,
    setFormData,
    customTags,
    suggestions,
    duplicateWarning,
    isGeocoding,
    isGeneratingTags,
    availableDistricts,
    availableCategorySubs,
    isFormValid,
    handleAddressChange,
    handlePlaceSelect,
    handleTagToggle,
    handleGetSuggestions,
    handleSubmit,
  };
}
