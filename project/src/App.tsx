import { useState, useEffect, useRef, useCallback } from 'react';
import { AddLocationModal } from './components/AddLocationModal';
import { DecisionEntryView } from './components/DecisionEntryView';
import { DecisionResultView } from './components/DecisionResultView';
import { BrowseConfirmView } from './components/BrowseConfirmView';
import { BrowseView } from './components/BrowseView';
import type { Location, Province, CategoryMain, CategorySub, ContentMode } from './types/location';
import {
  REGION_HIERARCHY,
  PROVINCES,
  inferProvinceFromRegion,
  getCategoryMainsByMode,
  getCategorySubsByMain,
} from './types/location';
import type { UiMode, Companion, TimeSlot, PriorityFeature } from './types/ui';
import { DEFAULT_FILTER_STATE, type FilterState } from './types/filter';
import { locationApi } from './utils/supabase';
import { decideLocations, type DecisionResult } from './utils/decisionEngine';
import { getLocationProvince, resolveCategoryMain } from './utils/locationHelpers';
import { SpeedInsights } from "@vercel/speed-insights/react";

export default function App() {
  const [contentMode, setContentMode] = useState<ContentMode>('food');
  // Data state
  const [locations, setLocations] = useState<Location[]>([]);

  // Filter state
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);

  // UI Mode state
  // 기본 시작 모드를 'decision'으로 설정 (의사결정 우선 UX)
  // URL에 locationId 파라미터가 있으면 나중에 browse로 전환됨
  const [uiMode, setUiMode] = useState<UiMode>('decision');

  // Decision flow state
  const [decisionResult, setDecisionResult] = useState<DecisionResult | null>(null);

  // Pagination
  const [visibleLocations, setVisibleLocations] = useState<number>(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 결과 없음 메시지 상태 (alert() 대체)
  const [noResultMessage, setNoResultMessage] = useState<string | null>(null);

  // 초기 데이터 로딩 상태
  const [isLoading, setIsLoading] = useState(true);

  /** Decision STEP1: 시/도별 세부지역. 전국구로 시/도 먼저 보여주고, 클릭 시 세부지역 펼침 */
  const availableProvincesWithDistricts: { province: Province; districts: string[] }[] = (() => {
    const regionSet = new Set(locations.map((l) => l.region).filter(Boolean));
    const result: { province: Province; districts: string[] }[] = [];
    for (const province of PROVINCES) {
      const hierarchyDistricts = REGION_HIERARCHY[province] || [];
      const dataDistricts = hierarchyDistricts.filter((d) => regionSet.has(d));
      const extra = [...regionSet].filter(
        (r) => inferProvinceFromRegion(r) === province && !hierarchyDistricts.includes(r)
      );
      const districts = [...new Set([...dataDistricts, ...extra])];
      if (districts.length > 0) {
        result.push({ province, districts });
      }
    }
    return result;
  })();

  const { selectedProvince, selectedDistrict, selectedCategoryMain, selectedCategorySub, selectedEventTag } = filters;

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

  // 대분류 목록 생성 (데이터에 있는 대분류만 표시)
  const availableCategoryMains: CategoryMain[] = (() => {
    const categoryMains = getCategoryMainsByMode(contentMode);
    if (!locationsForCategoryFilter || locationsForCategoryFilter.length === 0) {
      return ['전체'];
    }
    return ['전체', ...categoryMains.filter(main => {
      if (main === '전체') return false;
      return locationsForCategoryFilter.some(l => {
        // categoryMain이 직접 있는 경우
        if (l.categoryMain === main) return true;
        // categorySub가 있으면 그것으로부터 대분류 역추론
        if (l.categorySub) {
          const inferredMain = resolveCategoryMain(l, contentMode);
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
      const subs = getCategorySubsByMain(selectedCategoryMain, contentMode);
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
        locationMain = resolveCategoryMain(location);
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

  // Displayed locations (필터 기반)
  const displayedLocations = filteredLocations;

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
          const inferredMain = resolveCategoryMain(l, contentMode);
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
  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await locationApi.getAll(contentMode);
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [contentMode]);

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
    curation_level?: number;
    lon: number;
    lat: number;
    memo?: string;
    short_desc?: string;
    kakao_place_id?: string;
    tags?: string[];
    contentType?: ContentMode;
  }) => {
    try {
      const data = await locationApi.create(
        {
          ...newLocation,
          contentType: contentMode,
        } as Omit<Location, 'id'>,
        contentMode
      );
      setLocations(prev => [...prev, data]);
      alert('새로운 장소가 추가되었습니다.');
    } catch (error) {
      console.error('Error adding location:', error);
      alert('새로운 장소 추가 중 문제가 발생했습니다.');
    }
  };

  // Filter handlers with reset
  const handleProvinceChange = (province: Province | '전체') => {
    setFilters((prev) => ({
      ...prev,
      selectedProvince: province,
      selectedDistrict: '전체',
      selectedCategoryMain: '전체',
      selectedCategorySub: '전체',
      selectedEventTag: null,
    }));
    setVisibleLocations(10);
  };

  const handleDistrictChange = (district: string | '전체') => {
    setFilters((prev) => ({
      ...prev,
      selectedDistrict: district,
      selectedCategoryMain: '전체',
      selectedCategorySub: '전체',
    }));
    setVisibleLocations(10);
  };

  const handleCategoryMainChange = (main: CategoryMain | '전체') => {
    setFilters((prev) => ({
      ...prev,
      selectedCategoryMain: main,
      selectedCategorySub: '전체',
    }));
    setVisibleLocations(10);
  };

  const handleCategorySubChange = (sub: CategorySub | '전체') => {
    setFilters((prev) => ({
      ...prev,
      selectedCategorySub: sub,
    }));
    setVisibleLocations(10);
  };

  // ─────────────────────────────────────────────
  // Decision Flow 핸들러
  // ─────────────────────────────────────────────

  /** 4단계 선택 완료(지역·동행·시간·우선조건) → 결정 엔진 실행 → result 모드 전환 */
  const handleDecide = useCallback((
    region: string | null,
    companion: Companion,
    timeSlot: TimeSlot,
    priorityFeature: PriorityFeature,
  ) => {
    if (contentMode === 'space') {
      if (region) {
        const inferredProvince = inferProvinceFromRegion(region);
        setFilters((prev) => ({
          ...prev,
          selectedProvince: inferredProvince ?? '전체',
          selectedDistrict: inferredProvince ? region : '전체',
          selectedCategoryMain: '전체',
          selectedCategorySub: '전체',
          selectedEventTag: null,
        }));
      }
      setDecisionResult(null);
      setUiMode('browse');
      return;
    }

    setNoResultMessage(null);
    const result = decideLocations(locations, companion, timeSlot, priorityFeature, region);
    if (result) {
      setDecisionResult(result);
      setUiMode('result');
    } else {
      // 결과 없음: 인라인 메시지로 알림, decision 화면에 그대로 머묾
      setNoResultMessage('조건에 맞는 장소가 아직 없어요. 필터를 바꾸거나 직접 둘러볼까요?');
    }
  }, [contentMode, locations]);

  /**
   * "직접 둘러보기" 클릭 → browse-confirm 인터스티셜로 이동
   * browse로 곧바로 가지 않는다. 의도적 마찰(interstitial guard) 삽입.
   */
  const handleSwitchToBrowse = useCallback(() => {
    setUiMode('browse-confirm');
    setDecisionResult(null);
  }, []);

  /** browse-confirm에서 "직접 둘러보기" 확정 → 실제 browse 진입 */
  const handleConfirmBrowse = useCallback(() => {
    setUiMode('browse');
  }, []);

  /** Decision 화면으로 복귀 (다시 고르기 / escape hatch) */
  const handleBackToDecision = useCallback(() => {
    setUiMode('decision');
    setDecisionResult(null);
  }, []);

  /** result → decision 전환 (다시 고르기) */
  const handleRetryDecision = useCallback(() => {
    setUiMode('decision');
    setDecisionResult(null);
  }, []);

  /** result 화면에서 장소 상세 보기 → browse 모드로 전환 */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDecisionOpenDetail = useCallback((_location: Location) => {
    // 장소 상세를 보려면 browse 모드로 진입 (인터스티셜 스킵)
    setUiMode('browse');
  }, []);

  // Pagination
  const handleShowMore = () => {
    setVisibleLocations(prev => prev + 10);
  };

  // 지도 인스턴스 저장 (Map 컴포넌트에서 호출)
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const handleMapReady = (map: kakao.maps.Map) => {
    mapRef.current = map;
  };

  // Load data on mount
  useEffect(() => {
    fetchLocations();
    setFilters(DEFAULT_FILTER_STATE);
    setVisibleLocations(10);
    setUiMode('decision');
    setDecisionResult(null);
  }, [contentMode, fetchLocations]);

  // URL 쿼리 파라미터에서 locationId 확인
  // 딥링크 진입 시 decision 모드를 건너뛰고 바로 browse로 전환
  useEffect(() => {
    if (locations.length === 0) return;

    const urlParams = new URLSearchParams(window.location.search);
    const locationId = urlParams.get('locationId');

    if (locationId) {
      const location = locations.find(loc => loc.id === locationId);
      if (location) {
        // 딥링크 진입이므로 인터스티셜 없이 바로 browse
        setUiMode('browse');
        // URL에서 쿼리 파라미터 제거
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [locations]);

  /** 화면 더블클릭 시 장소 추가 모달 열기 (숨겨진 단축키) */
  const handleScreenDoubleClick = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  return (
    <div
      className="min-h-screen w-full"
      onDoubleClick={handleScreenDoubleClick}
      role="application"
      aria-label="JWMAP 큐레이션"
    >
      <div className="fixed right-4 top-4 z-[60] rounded-xl border border-gray-200 bg-white/95 p-1 shadow-sm backdrop-blur">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setContentMode('food')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              contentMode === 'food'
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            맛집/카페
          </button>
          <button
            onClick={() => setContentMode('space')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              contentMode === 'space'
                ? 'bg-violet-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            볼거리
          </button>
        </div>
      </div>

      {/* ── 초기 로딩 ── */}
      {isLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white" aria-label="로딩 중" role="status">
          <div className={`h-8 w-8 animate-spin rounded-full border-2 border-gray-200 ${contentMode === 'space' ? 'border-t-violet-600' : 'border-t-orange-500'}`} />
        </div>
      )}

      {/* ── Decision Entry View (기본 진입 화면) ── */}
      {!isLoading && uiMode === 'decision' && (
        <DecisionEntryView
          contentMode={contentMode}
          availableProvincesWithDistricts={availableProvincesWithDistricts}
          onDecide={handleDecide}
          onBrowse={handleSwitchToBrowse}
          noResultMessage={noResultMessage}
        />
      )}

      {/* ── Decision Result View (결정 결과 화면) ── */}
      {!isLoading && uiMode === 'result' && decisionResult && contentMode === 'food' && (
        <DecisionResultView
          result={decisionResult}
          onRetry={handleRetryDecision}
          onBrowse={handleSwitchToBrowse}
          onOpenDetail={handleDecisionOpenDetail}
        />
      )}

      {/* ── Browse Confirm (인터스티셜 가드) ── */}
      {/* 의도적 마찰: browse 진입 전에 한 번 더 확인. Decision 복귀를 유도. */}
      {!isLoading && uiMode === 'browse-confirm' && (
        <BrowseConfirmView
          contentMode={contentMode}
          onBackToDecision={handleBackToDecision}
          onProceedToBrowse={handleConfirmBrowse}
        />
      )}

      {/* ── Browse View (의도적으로 열등한 탐색 UX) ── */}
      {!isLoading && uiMode === 'browse' && (
        <BrowseView
          contentMode={contentMode}
          displayedLocations={displayedLocations}
          filterState={filters}
          filterControls={{
            onProvinceChange: handleProvinceChange,
            onDistrictChange: handleDistrictChange,
            onCategoryMainChange: handleCategoryMainChange,
            onCategorySubChange: handleCategorySubChange,
          }}
          filterOptions={{
            availableCategoryMains,
            getCategoryMainCount,
            availableCategorySubs,
            getCategorySubCount,
            availableDistricts,
            getProvinceCount,
            getDistrictCount,
          }}
          visibleLocations={visibleLocations}
          onShowMore={handleShowMore}
          onBackToDecision={handleBackToDecision}
          onMapReady={handleMapReady}
        />
      )}

      {/* Add Location Modal */}
      {isModalOpen && (
        <AddLocationModal
          contentMode={contentMode}
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
    </div>
  );
}
