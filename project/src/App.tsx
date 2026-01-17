import { useState, useEffect, useRef } from 'react';
import { MobileLayout } from './components/layout/MobileLayout';
import { DesktopLayout } from './components/layout/DesktopLayout';
import { AddLocationModal } from './components/AddLocationModal';
import { PlaceDetail } from './components/PlaceDetail';
import { Footer } from './components/Footer';
import type { Location, Features, Province, CategoryMain, CategorySub } from './types/location';
import { REGION_HIERARCHY, inferProvinceFromRegion, CATEGORY_MAINS, CATEGORY_HIERARCHY, getCategorySubsByMain } from './types/location';
import type { UiMode, BottomSheetState, SheetMode } from './types/ui';
import { useBreakpoint } from './hooks/useBreakpoint';
import { locationApi } from './utils/supabase';
import { SpeedInsights } from "@vercel/speed-insights/react";

export default function App() {
  const { isMobile } = useBreakpoint();

  // Data state
  const [locations, setLocations] = useState<Location[]>([]);

  // Filter state
  const [selectedProvince, setSelectedProvince] = useState<Province | '전체'>('전체');
  const [selectedDistrict, setSelectedDistrict] = useState<string | '전체'>('전체');
  const [selectedCategoryMain, setSelectedCategoryMain] = useState<CategoryMain | '전체'>('전체');
  const [selectedCategorySub, setSelectedCategorySub] = useState<CategorySub | '전체'>('전체');
  const [selectedEventTag, setSelectedEventTag] = useState<string | null>(null);

  // Selection state
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [previewLocation, setPreviewLocation] = useState<Location | null>(null);
  const [detailLocation, setDetailLocation] = useState<Location | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);

  // UI Mode state (mobile)
  const [uiMode, setUiMode] = useState<UiMode>('browse');
  const [bottomSheetState, setBottomSheetState] = useState<BottomSheetState>('half');
  const [sheetMode, setSheetMode] = useState<SheetMode>('list');

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const preFilteredListRef = useRef<Location[]>([]);

  // Pagination
  const [visibleLocations, setVisibleLocations] = useState<number>(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Helper: Get location province
  const getLocationProvince = (location: Location): Province | null => {
    if (location.province) return location.province;
    return inferProvinceFromRegion(location.region);
  };

  // Available districts for selected province
  const availableDistricts: string[] = selectedProvince === '전체'
    ? []
    : (() => {
        const hierarchyDistricts = REGION_HIERARCHY[selectedProvince] || [];
        const dataDistricts = new Set(
        locations
            .filter(l => getLocationProvince(l) === selectedProvince)
            .map(l => l.region)
        );
        return [...new Set([...hierarchyDistricts.filter(d => dataDistricts.has(d)), ...dataDistricts])];
      })();

  // Base locations for category list/count (province + district + event, but NOT category)
  const locationsForCategoryFilter = locations.filter(location => {
    const province = getLocationProvince(location);
    const matchesProvince = selectedProvince === '전체' || province === selectedProvince;
    const matchesDistrict = selectedDistrict === '전체' || location.region === selectedDistrict;
    const matchesEvent = !selectedEventTag ||
      (location.eventTags && location.eventTags.includes(selectedEventTag));
    return matchesProvince && matchesDistrict && matchesEvent;
  });

  // categorySub로부터 대분류를 역추론하는 헬퍼 함수
  const getMainFromSub = (sub: CategorySub): CategoryMain | null => {
    for (const [main, subs] of Object.entries(CATEGORY_HIERARCHY) as [CategoryMain, CategorySub[]][]) {
      if (subs.includes(sub)) {
        return main;
      }
    }
    return null;
  };

  // 대분류 목록 생성 (데이터에 있는 대분류만 표시)
  const availableCategoryMains: CategoryMain[] = (() => {
    if (!locationsForCategoryFilter || locationsForCategoryFilter.length === 0) {
      return ['전체'];
    }
    return ['전체', ...CATEGORY_MAINS.filter(main => {
      if (main === '전체') return false;
      return locationsForCategoryFilter.some(l => {
        // categoryMain이 직접 있는 경우
        if (l.categoryMain === main) return true;
        // categorySub가 있으면 그것으로부터 대분류 역추론
        if (l.categorySub) {
          const inferredMain = getMainFromSub(l.categorySub);
          if (inferredMain === main) return true;
        }
        return false;
      });
    })];
  })();

  // 선택된 대분류의 소분류 목록 (데이터에 있는 소분류만 표시)
  const availableCategorySubs: CategorySub[] = (() => {
    if (selectedCategoryMain === '전체' || !selectedCategoryMain) {
      return [];
    }
    if (!locationsForCategoryFilter || locationsForCategoryFilter.length === 0) {
      return [];
    }
    try {
      const subs = getCategorySubsByMain(selectedCategoryMain);
      if (!subs || subs.length === 0) {
        return [];
      }
      return subs.filter(sub => {
        return locationsForCategoryFilter.some(l => {
          // categorySub가 직접 있는 경우
          if (l.categorySub === sub) return true;
          // categoryMain이 선택된 대분류와 일치하는 경우 (소분류가 없어도 해당 대분류에 속함)
          if (l.categoryMain === selectedCategoryMain) return true;
          return false;
        });
      });
    } catch (error) {
      console.error('Error getting category subs:', error, { selectedCategoryMain });
      return [];
    }
  })();

  // Filtered locations
  const filteredLocations = locations.filter(location => {
    const province = getLocationProvince(location);
    const matchesProvince = selectedProvince === '전체' || province === selectedProvince;
    const matchesDistrict = selectedDistrict === '전체' || location.region === selectedDistrict;
    
    // 카테고리 필터링: categoryMain과 categorySub만 사용
    let matchesCategory = true;
    
    if (selectedCategoryMain !== '전체') {
      // 대분류 매칭
      let locationMain: CategoryMain | null = null;
      
      // 1. categoryMain이 직접 있는 경우
      if (location.categoryMain) {
        locationMain = location.categoryMain;
      }
      // 2. categorySub가 있으면 그것으로부터 대분류 역추론
      else if (location.categorySub) {
        locationMain = getMainFromSub(location.categorySub);
      }
      
      // 대분류가 없거나 일치하지 않으면 제외
      if (!locationMain || locationMain !== selectedCategoryMain) {
        matchesCategory = false;
      } 
      // 대분류가 일치하는 경우
      else {
        // 소분류도 선택된 경우
        if (selectedCategorySub !== '전체') {
          // 소분류 매칭 - categorySub만 확인
          if (!location.categorySub || location.categorySub !== selectedCategorySub) {
            matchesCategory = false;
          }
        }
        // 소분류가 '전체'인 경우는 모두 포함 (이미 대분류 일치 확인됨)
      }
    }
    
    const matchesEvent = !selectedEventTag ||
      (location.eventTags && location.eventTags.includes(selectedEventTag));
    return matchesProvince && matchesDistrict && matchesCategory && matchesEvent;
  });

  // Displayed locations (search or filter)
  const displayedLocations = isSearchMode ? searchResults : filteredLocations;

  // Count functions
  const getProvinceCount = (province: Province | '전체'): number => {
    if (province === '전체') return locations.length;
    return locations.filter(l => getLocationProvince(l) === province).length;
  };

  const getDistrictCount = (district: string): number => {
    return locations.filter(l =>
      getLocationProvince(l) === selectedProvince && l.region === district
    ).length;
  };

  const getCategoryMainCount = (main: CategoryMain | '전체'): number => {
    if (!locationsForCategoryFilter || locationsForCategoryFilter.length === 0) {
      return main === '전체' ? 0 : 0;
    }
    
    if (main === '전체') return locationsForCategoryFilter.length;
    
    try {
      // 대분류 카운트는 해당 대분류에 속한 모든 소분류의 합계
      const subsForMain = getCategorySubsByMain(main);
      return locationsForCategoryFilter.filter(l => {
        // 1. categoryMain이 직접 일치하는 경우
        if (l.categoryMain === main) return true;
        
        // 2. categorySub가 해당 대분류의 소분류 중 하나인 경우
        if (l.categorySub && subsForMain.includes(l.categorySub)) return true;
        
        // 3. categorySub만 있고 categoryMain이 없는 경우, 역추론으로 확인
        if (l.categorySub && !l.categoryMain) {
          const inferredMain = getMainFromSub(l.categorySub);
          if (inferredMain === main) return true;
        }
        
        return false;
      }).length;
    } catch (error) {
      console.error('Error getting category main count:', error);
      return 0;
    }
  };

  const getCategorySubCount = (sub: CategorySub): number => {
    if (!locationsForCategoryFilter || locationsForCategoryFilter.length === 0) {
      return 0;
    }
    try {
      return locationsForCategoryFilter.filter(l => {
        return l.categorySub === sub;
      }).length;
    } catch (error) {
      console.error('Error getting category sub count:', error);
      return 0;
    }
  };

  // Data fetching
  const fetchLocations = async () => {
    try {
      const data = await locationApi.getAll();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };
  
  // Add location
  const handleAddLocation = async (newLocation: {
    name: string;
    province?: Province;
    region: string;
    categoryMain?: CategoryMain;
    categorySub?: CategorySub;
    address: string;
    imageUrl: string;
    rating: number;
    lon: number;
    lat: number;
    memo?: string;
    short_desc?: string;
    kakao_place_id?: string;
    features?: Features;
    tags?: string[];
  }) => {
    try {
      const data = await locationApi.create(newLocation as Omit<Location, 'id'>);
      setLocations(prev => [...prev, data]);
      alert('새로운 장소가 추가되었습니다.');
    } catch (error) {
      console.error('Error adding location:', error);
      alert('새로운 장소 추가 중 문제가 발생했습니다.');
    }
  };

  // Update location
  const handleUpdate = async (updatedLocation: Location) => {
    try {
      const data = await locationApi.update(updatedLocation.id, updatedLocation);
      setLocations(prev => prev.map(loc => loc.id === data.id ? data : loc));
      // 현재 선택된 장소도 업데이트
      if (selectedLocation?.id === data.id) {
        setSelectedLocation(data);
      }
      if (previewLocation?.id === data.id) {
        setPreviewLocation(data);
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('장소 수정 중 문제가 발생했습니다.');
    }
  };

  // Delete location
  const handleDelete = async (id: string) => {
    try {
      await locationApi.delete(id);
      setLocations(prev => prev.filter(loc => loc.id !== id));
      // 현재 선택된 장소가 삭제된 경우 초기화
      if (selectedLocation?.id === id) {
        setSelectedLocation(null);
      }
      if (previewLocation?.id === id) {
        setPreviewLocation(null);
      }
      alert('장소가 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('장소 삭제 중 문제가 발생했습니다.');
    }
  };

  // Search handlers
  const handleSearchResults = (places: Location[]) => {
    if (!isSearchMode) {
      preFilteredListRef.current = filteredLocations;
    }
    setSearchResults(places);
    setIsSearchMode(true);
    setVisibleLocations(10);

    // Auto-switch to explore mode on mobile
    if (isMobile) {
      setUiMode('explore');
      setBottomSheetState('half');
    }
  };

  const handleSearchSelect = (placeId: string) => {
    const place = searchResults.find(p => p.id === placeId);
    if (place) {
      setSelectedLocation(place);
      setPreviewLocation(place);
    }
  };

  const handleSearchReset = () => {
    setIsSearchMode(false);
    setSearchResults([]);
    setCurrentSearchId(null);
    setVisibleLocations(10);
    setSelectedLocation(null);
    setPreviewLocation(null);
  };

  // Filter handlers with reset
  const handleProvinceChange = (province: Province | '전체') => {
    setSelectedProvince(province);
    setSelectedDistrict('전체');
    setSelectedCategoryMain('전체');
    setSelectedCategorySub('전체');
    setSelectedEventTag(null);
    setVisibleLocations(10);
  };

  const handleDistrictChange = (district: string | '전체') => {
    setSelectedDistrict(district);
    setSelectedCategoryMain('전체');
    setSelectedCategorySub('전체');
    setVisibleLocations(10);
  };

  const handleCategoryMainChange = (main: CategoryMain | '전체') => {
    setSelectedCategoryMain(main);
    setSelectedCategorySub('전체'); // 대분류 변경 시 소분류 초기화
    setVisibleLocations(10);
  };

  const handleCategorySubChange = (sub: CategorySub | '전체') => {
    setSelectedCategorySub(sub);
    setVisibleLocations(10);
  };

  // Pagination
  const handleShowMore = () => {
    setVisibleLocations(prev => prev + 10);
  };

  // Open detail modal
  const handleOpenDetail = (location: Location) => {
    setDetailLocation(location);
  };

  // Load data on mount
  useEffect(() => {
    fetchLocations();
  }, []);

  // URL 쿼리 파라미터에서 locationId 확인하고 상세 화면 열기
  useEffect(() => {
    if (locations.length === 0) return; // locations가 로드되지 않았으면 대기

    const urlParams = new URLSearchParams(window.location.search);
    const locationId = urlParams.get('locationId');

    if (locationId) {
      // 해당 locationId를 가진 장소 찾기
      const location = locations.find(loc => loc.id === locationId);
      if (location) {
        // 상세 모달 열기
        setDetailLocation(location);
        
        // URL에서 쿼리 파라미터 제거 (히스토리 업데이트)
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [locations]);

  // Common layout props
  const layoutProps = {
    locations,
    displayedLocations,
    selectedLocation,
    onSelectLocation: setSelectedLocation,
    previewLocation,
    onPreviewLocation: setPreviewLocation,
    onOpenDetail: handleOpenDetail,
    isSearchMode,
    onSearchResults: handleSearchResults,
    onSearchSelect: handleSearchSelect,
    onSearchReset: handleSearchReset,
    currentSearchId,
    onSearchIdChange: setCurrentSearchId,
    selectedProvince,
    onProvinceChange: handleProvinceChange,
    selectedDistrict,
    onDistrictChange: handleDistrictChange,
    selectedCategoryMain,
    onCategoryMainChange: handleCategoryMainChange,
    availableCategoryMains,
    getCategoryMainCount,
    selectedCategorySub,
    onCategorySubChange: handleCategorySubChange,
    availableCategorySubs,
    getCategorySubCount,
    availableDistricts,
    getProvinceCount,
    getDistrictCount,
    visibleLocations,
    onShowMore: handleShowMore,
    onOpenAddModal: () => setIsModalOpen(true),
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  };

  return (
    <>
      {/* Main Layout */}
      {isMobile ? (
        <MobileLayout
          {...layoutProps}
          uiMode={uiMode}
          onModeChange={setUiMode}
          bottomSheetState={bottomSheetState}
          onBottomSheetStateChange={setBottomSheetState}
          sheetMode={sheetMode}
          onSheetModeChange={setSheetMode}
        />
      ) : (
        <DesktopLayout
          {...layoutProps}
          hoveredLocationId={hoveredLocationId}
          onHoverLocation={setHoveredLocationId}
        />
      )}

      {/* Footer - Only show in browse mode on mobile, always on desktop */}
      {(!isMobile || (isMobile && uiMode === 'browse')) && (
        <Footer />
      )}

      {/* Add Location Modal */}
        {isModalOpen && (
          <AddLocationModal
            onClose={() => setIsModalOpen(false)}
            onSave={handleAddLocation}
          existingLocations={locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            address: loc.address,
            kakao_place_id: loc.kakao_place_id,
          }))}
        />
      )}

      {/* Place Detail Modal */}
      {detailLocation && (
        <PlaceDetail
          location={detailLocation}
          onClose={() => setDetailLocation(null)}
          isMobile={isMobile}
        />
      )}

      <SpeedInsights />
    </>
  );
}
