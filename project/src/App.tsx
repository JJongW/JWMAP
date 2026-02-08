import { useState, useEffect, useRef, useCallback } from 'react';
import { MobileLayout } from './components/layout/MobileLayout';
import { DesktopLayout } from './components/layout/DesktopLayout';
import { AddLocationModal } from './components/AddLocationModal';
import { DecisionEntryView } from './components/DecisionEntryView';
import { DecisionResultView } from './components/DecisionResultView';
import { Footer } from './components/Footer';
import type { Location, Features, Province, CategoryMain, CategorySub } from './types/location';
import { REGION_HIERARCHY, inferProvinceFromRegion, CATEGORY_MAINS, CATEGORY_HIERARCHY, getCategorySubsByMain } from './types/location';
import type { UiMode, BottomSheetState, SheetMode, Companion, TimeSlot, PriorityFeature } from './types/ui';
import { useBreakpoint } from './hooks/useBreakpoint';
import { locationApi } from './utils/supabase';
import { decideLocations, type DecisionResult } from './utils/decisionEngine';
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
  const [detailLocation, setDetailLocation] = useState<Location | null>(null); // 모바일 디테일 뷰용
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);

  // UI Mode state
  // 기본 시작 모드를 'decision'으로 설정 (의사결정 우선 UX)
  // URL에 locationId 파라미터가 있으면 나중에 browse로 전환됨
  const [uiMode, setUiMode] = useState<UiMode>('decision');
  const [bottomSheetState, setBottomSheetState] = useState<BottomSheetState>('half');
  const [sheetMode, setSheetMode] = useState<SheetMode>('list');

  // Decision flow state
  const [decisionResult, setDecisionResult] = useState<DecisionResult | null>(null);

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const preFilteredListRef = useRef<Location[]>([]);

  // Pagination
  const [visibleLocations, setVisibleLocations] = useState<number>(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // User location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const mapRef = useRef<kakao.maps.Map | null>(null);

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
      if (detailLocation?.id === data.id) {
        setDetailLocation(data);
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

  // 이벤트 태그 토글 핸들러
  const handleEventTagToggle = (tag: string | null) => {
    setSelectedEventTag(tag);
    setVisibleLocations(10);
  };

  // 사용 가능한 이벤트 태그 목록 추출
  const availableEventTags: string[] = (() => {
    const eventTagSet = new Set<string>();
    locations.forEach(location => {
      if (location.eventTags && Array.isArray(location.eventTags)) {
        location.eventTags.forEach(tag => {
          if (tag && tag.trim()) {
            eventTagSet.add(tag.trim());
          }
        });
      }
    });
    // "흑백요리사 시즌2", "천하제빵 시즌1" 순서 유지
    const orderedTags = ['흑백요리사 시즌2', '천하제빵 시즌1'];
    const otherTags = Array.from(eventTagSet).filter(tag => !orderedTags.includes(tag));
    return [...orderedTags.filter(tag => eventTagSet.has(tag)), ...otherTags];
  })();

  // ─────────────────────────────────────────────
  // Decision Flow 핸들러
  // ─────────────────────────────────────────────

  /** 3단계 선택 완료 → 결정 엔진 실행 → result 모드 전환 */
  const handleDecide = useCallback((
    companion: Companion,
    timeSlot: TimeSlot,
    priorityFeature: PriorityFeature,
  ) => {
    const result = decideLocations(locations, companion, timeSlot, priorityFeature);
    if (result) {
      setDecisionResult(result);
      setUiMode('result');
    } else {
      // 결과 없음: 사용자에게 알림 후 browse 모드로 전환
      alert('조건에 맞는 장소가 아직 없어요. 직접 둘러볼까요?');
      setUiMode('browse');
    }
  }, [locations]);

  /** decision → browse 전환 (기존 탐색 모드) */
  const handleSwitchToBrowse = useCallback(() => {
    setUiMode('browse');
    setDecisionResult(null);
  }, []);

  /** result → decision 전환 (다시 고르기) */
  const handleRetryDecision = useCallback(() => {
    setUiMode('decision');
    setDecisionResult(null);
  }, []);

  /** result 화면에서 장소 상세 보기 */
  const handleDecisionOpenDetail = useCallback((location: Location) => {
    // 기존 상세 보기 로직 재사용
    setSelectedLocation(location);
    setPreviewLocation(location);
    if (isMobile) {
      setDetailLocation(location);
    }
    // browse 모드로 전환하여 기존 레이아웃에서 상세 보기
    setUiMode('browse');
  }, [isMobile]);

  // Pagination
  const handleShowMore = () => {
    setVisibleLocations(prev => prev + 10);
  };

  // Open detail - 모바일은 페이지로, PC는 SidebarDetail로
  const handleOpenDetail = (location: Location) => {
    setSelectedLocation(location);
    setPreviewLocation(location);
    if (isMobile) {
      // 모바일: 페이지 형식으로 디테일 뷰 표시
      setDetailLocation(location);
    }
    // PC: previewLocation이 설정되면 자동으로 SidebarDetail이 표시됨
  };

  // 사용자 위치 가져오기
  const handleGetUserLocation = () => {
    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      return;
    }

    setIsLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        setIsLoadingLocation(false);

        // 지도를 사용자 위치로 이동
        if (mapRef.current) {
          try {
            const userLatLng = new kakao.maps.LatLng(latitude, longitude);
            mapRef.current.setLevel(3);
            mapRef.current.panTo(userLatLng);
          } catch (e) {
            console.error('지도 이동 오류:', e);
          }
        }
      },
      (error) => {
        setIsLoadingLocation(false);
        let errorMessage = '위치를 가져올 수 없습니다.';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '위치 정보를 사용할 수 없습니다.';
            break;
          case error.TIMEOUT:
            errorMessage = '위치 요청 시간이 초과되었습니다.';
            break;
        }
        
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // 지도 인스턴스 저장 (Map 컴포넌트에서 호출)
  const handleMapReady = (map: kakao.maps.Map) => {
    mapRef.current = map;
  };

  // Load data on mount
  useEffect(() => {
    fetchLocations();
  }, []);

  // URL 쿼리 파라미터에서 locationId 확인하고 상세 화면 열기
  // locationId가 있으면 decision 모드를 건너뛰고 바로 browse + 상세 보기
  useEffect(() => {
    if (locations.length === 0) return; // locations가 로드되지 않았으면 대기

    const urlParams = new URLSearchParams(window.location.search);
    const locationId = urlParams.get('locationId');

    if (locationId) {
      // 해당 locationId를 가진 장소 찾기
      const location = locations.find(loc => loc.id === locationId);
      if (location) {
        // decision 모드에서 browse로 전환 (딥링크 진입이므로)
        setUiMode('browse');

        // 선택된 장소 설정
        setSelectedLocation(location);
        setPreviewLocation(location);
        
        if (isMobile) {
          // 모바일: 페이지 형식으로 디테일 뷰 표시
          setDetailLocation(location);
        }
        // PC: previewLocation이 설정되면 자동으로 SidebarDetail이 표시됨
        
        // URL에서 쿼리 파라미터 제거 (히스토리 업데이트)
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [locations, isMobile]);

  // Common layout props
  const layoutProps = {
    locations,
    displayedLocations,
    selectedLocation,
    onSelectLocation: setSelectedLocation,
    previewLocation,
    onPreviewLocation: setPreviewLocation,
    detailLocation,
    onDetailLocationChange: setDetailLocation,
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
    // Event Tag Filter
    availableEventTags,
    selectedEventTag,
    onEventTagToggle: handleEventTagToggle,
    // User Location
    userLocation,
    isLoadingLocation,
    onGetUserLocation: handleGetUserLocation,
    onMapReady: handleMapReady,
  };

  // MobileLayout에는 기존 UiMode 중 browse/explore만 전달
  // decision/result 모드일 때는 MobileLayout의 uiMode를 'browse'로 설정
  const mobileUiMode: 'browse' | 'explore' = (uiMode === 'browse' || uiMode === 'explore')
    ? uiMode as 'browse' | 'explore'
    : 'browse';

  return (
    <>
      {/* ── Decision Entry View (기본 진입 화면) ── */}
      {uiMode === 'decision' && (
        <DecisionEntryView
          onDecide={handleDecide}
          onBrowse={handleSwitchToBrowse}
        />
      )}

      {/* ── Decision Result View (추천 결과 화면) ── */}
      {uiMode === 'result' && decisionResult && (
        <DecisionResultView
          result={decisionResult}
          onRetry={handleRetryDecision}
          onBrowse={handleSwitchToBrowse}
          onOpenDetail={handleDecisionOpenDetail}
        />
      )}

      {/* ── 기존 Browse/Explore Layout (탐색 모드) ── */}
      {(uiMode === 'browse' || uiMode === 'explore') && (
        <>
          {isMobile ? (
            <MobileLayout
              {...layoutProps}
              uiMode={mobileUiMode}
              onModeChange={(mode: string) => setUiMode(mode as UiMode)}
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
          {(!isMobile || (isMobile && mobileUiMode === 'browse')) && (
            <Footer />
          )}
        </>
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

      <SpeedInsights />
    </>
  );
}
