import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AddLocationModal } from './components/AddLocationModal';
import { DecisionEntryView, type EntryDraft } from './components/DecisionEntryView';
import { DecisionResultView } from './components/DecisionResultView';
import { BrowseView } from './components/BrowseView';
import { PlaceDetail } from './components/PlaceDetail';
import { useBreakpoint } from './hooks/useBreakpoint';
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
import { getCuratorReason, isCuratorVisited } from './utils/curation';
import { applyTextEdit, buildPlaceAliases, conditionsToText, EMPTY_CONDITIONS, inferConditionMode, parseIntentText, resolveIntent, unreadWords, type IntentConditions } from './utils/intentChips';
import { getLocationProvince, resolveCategoryMain } from './utils/locationHelpers';
import { clearPlaceStates, getActivityScore, getSavedIds, getVisitedIds, recordActivity, syncPlaceStateFromRemote } from './utils/activity';
import { SpeedInsights } from "@vercel/speed-insights/react";
import type { SavedView } from './components/browse/types';

export default function App() {
  const [contentMode, setContentMode] = useState<ContentMode>('food');
  // Data state
  const [locations, setLocations] = useState<Location[]>([]);

  // Filter state
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);

  // UI Mode state
  // 첫 화면(browse + 탐색 닫힘)은 추천받기가 대표 행동이고, 이름 검색·지도·목록은 '직접 찾아보기'로 연다.
  const [uiMode, setUiMode] = useState<UiMode>('browse');
  const [browseExploring, setBrowseExploring] = useState(false);

  // Decision flow state
  const [decisionResult, setDecisionResult] = useState<DecisionResult | null>(null);
  /** 추천 결과 화면 위에 연 장소 상세. 닫으면 같은 결과 화면(조건 그대로)으로 돌아간다 */
  const [resultDetail, setResultDetail] = useState<Location | null>(null);
  /** 좁은 화면에서 추천 결과를 지도로 보고 있는지 (넓은 화면은 결과 옆에 늘 지도가 있다) */
  const [resultMapOpen, setResultMapOpen] = useState(false);
  const { isMobile } = useBreakpoint();

  // Pagination
  const [visibleLocations, setVisibleLocations] = useState<number>(10);
  const [showFullMapStart, setShowFullMapStart] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedView, setSavedView] = useState<SavedView>('saved');
  const [savedLocationIds, setSavedLocationIds] = useState<Set<string>>(() => new Set());
  const [visitedLocationIds, setVisitedLocationIds] = useState<Set<string>>(() => new Set());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 추천 조건: 입력 문장·빠른 시작·질문형 화면이 같은 조건을 공유하고, 결과 화면 칩에서 고친다
  const [conditions, setConditions] = useState<IntentConditions>(EMPTY_CONDITIONS);
  /** 문장에서 조건을 하나도 못 읽었을 때 결과 화면에서 안내한다 */
  const [intentNotice, setIntentNotice] = useState<string | null>(null);
  /** 추천을 찾은 데이터. '비 오는 날 전시'처럼 다른 탭의 장소 종류를 물으면 그쪽에서 찾는다 */
  const [decisionMode, setDecisionMode] = useState<ContentMode>('food');
  const otherModeCache = useRef<Partial<Record<ContentMode, Location[]>>>({});

  // 화면 이동 기록: 결과·조건 수정·상세를 브라우저 뒤로/앞으로와 같은 흐름으로 맞춘다
  /** 지금 보고 있는 추천 결과 (조건 수정 중이면 그 원래 결과) */
  const [currentSnap, setCurrentSnap] = useState<ResultSnapshot | null>(null);
  /** 결과에서 '조건 수정'으로 온 입력 화면이면 그 결과. 돌아가기는 이 결과로 */
  const [editingSnap, setEditingSnap] = useState<ResultSnapshot | null>(null);
  /** 첫 화면 입력 문장. 결과를 다녀와도 남는다 ('처음부터 다시'에서만 지운다) */
  const [intentText, setIntentText] = useState('');
  /** 하나씩 고르기 화면에서 고르던 값 */
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(EMPTY_DRAFT);
  /** 새로고침·외부 지도에서 돌아왔을 때 이어서 보여줄 첫 기록 */
  const initialNav = useRef<NavEntry | null>(readNavEntry(window.history.state));
  const applySeq = useRef(0);

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

  const getCuratedLocations = useCallback((source: Location[]) => {
    return [...source]
      .sort((a, b) => {
        const aScore =
          (a.curation_level ?? 1) * 12 +
          getActivityScore(a) * 8 +
          (a.imageUrl ? 3 : 0) +
          (getCuratorReason(a) ? 2 : 0) +
          // 먼저 볼 곳은 운영자가 직접 가본 곳을 앞에 둔다 (미방문 후보의 큐레이션 단계보다 우선)
          (isCuratorVisited(a) ? 100 : 0);
        const bScore =
          (b.curation_level ?? 1) * 12 +
          getActivityScore(b) * 8 +
          (b.imageUrl ? 3 : 0) +
          (getCuratorReason(b) ? 2 : 0) +
          (isCuratorVisited(b) ? 100 : 0);
        return bScore - aScore;
      })
      .slice(0, contentMode === 'space' ? 24 : 36);
  }, [contentMode]);

  const refreshPlaceStateIds = useCallback(() => {
    setSavedLocationIds(new Set(getSavedIds()));
    setVisitedLocationIds(new Set(getVisitedIds()));
  }, []);

  const savedLocationCount = useMemo(
    () => locations.filter((location) => savedLocationIds.has(location.id)).length,
    [locations, savedLocationIds]
  );
  const visitedLocationCount = useMemo(
    () => locations.filter((location) => visitedLocationIds.has(location.id)).length,
    [locations, visitedLocationIds]
  );
  const myPlaceCount = useMemo(
    () => locations.filter((location) => savedLocationIds.has(location.id) || visitedLocationIds.has(location.id)).length,
    [locations, savedLocationIds, visitedLocationIds]
  );

  const revisitLocations = useMemo(() => {
    return filteredLocations
      .filter((location) => visitedLocationIds.has(location.id))
      .sort((a, b) => {
        const aScore =
          (a.curation_level ?? 1) * 12 +
          getActivityScore(a) * 8 +
          (a.short_desc || a.memo ? 4 : 0) +
          (a.imageUrl ? 3 : 0);
        const bScore =
          (b.curation_level ?? 1) * 12 +
          getActivityScore(b) * 8 +
          (b.short_desc || b.memo ? 4 : 0) +
          (b.imageUrl ? 3 : 0);
        return bScore - aScore;
      });
  }, [filteredLocations, visitedLocationIds]);

  const curatedFilteredLocations = useMemo(
    () => getCuratedLocations(filteredLocations),
    [filteredLocations, getCuratedLocations]
  );

  /** 지역 칩·문장 해석용: 장소가 많은 지역 순 */
  /** '을지로'·'익선동'처럼 지역 이름에 없는 동네 이름 → 지역 (장소 주소에서 모은다) */
  const placeAliases = useMemo(() => buildPlaceAliases(locations), [locations]);

  const regionOptions = useMemo(() => {
    const counts = new Map<string, number>();
    locations.forEach((location) => {
      if (location.region) counts.set(location.region, (counts.get(location.region) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([region]) => region);
  }, [locations]);

  const hotRegions = useMemo(() => {
    const regionScores = new Map<string, number>();
    locations.forEach((location) => {
      const score = (location.curation_level ?? 1) * 4 + getActivityScore(location) * 6 + (location.imageUrl ? 1 : 0);
      regionScores.set(location.region, (regionScores.get(location.region) ?? 0) + score);
    });
    return [...regionScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([region]) => region);
  }, [locations]);

  // Displayed locations. 넓은 필터를 눌러도 바로 전체 목록으로 풀지 않고, 먼저 볼 후보를 유지한다.
  const displayedLocations = showSavedOnly
    ? savedView === 'revisit'
      ? revisitLocations
      : filteredLocations.filter((location) =>
          savedView === 'visited'
            ? visitedLocationIds.has(location.id)
            : savedLocationIds.has(location.id)
        )
    : showFullMapStart
      ? filteredLocations
      : curatedFilteredLocations;

  const isCuratedDisplay = !showSavedOnly && !showFullMapStart;

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
    recordActivity('hot_region_click', undefined, { region: province });
    setFilters((prev) => ({
      ...prev,
      selectedProvince: province,
      selectedDistrict: '전체',
      selectedCategoryMain: '전체',
      selectedCategorySub: '전체',
      selectedEventTag: null,
    }));
    setVisibleLocations(10);
    setShowFullMapStart(false);
  };

  const handleDistrictChange = (district: string | '전체') => {
    recordActivity('hot_region_click', undefined, { region: district });
    setFilters((prev) => ({
      ...prev,
      selectedDistrict: district,
      selectedCategoryMain: '전체',
      selectedCategorySub: '전체',
    }));
    setVisibleLocations(10);
    setShowFullMapStart(false);
  };

  const handleCategoryMainChange = (main: CategoryMain | '전체') => {
    setFilters((prev) => ({
      ...prev,
      selectedCategoryMain: main,
      selectedCategorySub: '전체',
    }));
    setVisibleLocations(10);
    setShowFullMapStart(false);
  };

  const handleCategorySubChange = (sub: CategorySub | '전체') => {
    setFilters((prev) => ({
      ...prev,
      selectedCategorySub: sub,
    }));
    setVisibleLocations(10);
    setShowFullMapStart(false);
  };

  // ─────────────────────────────────────────────
  // Decision Flow 핸들러
  // ─────────────────────────────────────────────

  /** 다른 탭(맛집↔볼거리) 데이터가 필요하면 한 번만 불러 둔다 */
  const getPool = useCallback(async (mode: ContentMode) => {
    if (mode === contentMode) return locations;
    const pool = otherModeCache.current[mode] ?? (await locationApi.getAll(mode).catch(() => []));
    otherModeCache.current[mode] = pool;
    return pool;
  }, [locations, contentMode]);

  /** 기록 하나를 화면에 그대로 옮긴다. 결과는 남겨 둔 조건으로 다시 계산한다 */
  const applyNav = useCallback(async (entry: NavEntry) => {
    const seq = ++applySeq.current;
    if (entry.view === 'home') {
      setEditingSnap(null);
      setResultDetail(null);
      setBrowseExploring(Boolean(entry.explore));
      setUiMode('browse');
      return;
    }
    if (entry.view === 'decision') {
      setEditingSnap(entry.editing ?? null);
      if (entry.editing) setEntryDraft(draftFromConditions(entry.editing.conditions));
      setResultDetail(null);
      setUiMode('decision');
      return;
    }
    if (entry.view === 'text-edit') {
      setEditingSnap(entry.editing);
      if (entry.editing.source.kind === 'text') setIntentText(entry.editing.source.text);
      setResultDetail(null);
      setBrowseExploring(false);
      setUiMode('browse');
      return;
    }
    const { snap } = entry;
    const pool = await getPool(snap.mode);
    if (seq !== applySeq.current) return;
    const result = decideLocations(pool, snap.conditions, snap.mode);
    setCurrentSnap(snap);
    setEditingSnap(null);
    setConditions(snap.conditions);
    setDecisionMode(snap.mode);
    setIntentNotice(snap.notice);
    setDecisionResult(result);
    if (snap.source.kind === 'text') setIntentText(snap.source.text);
    if (snap.source.kind === 'options') setEntryDraft(draftFromConditions(snap.conditions));
    setResultDetail(entry.detailId ? pool.find((loc) => loc.id === entry.detailId) ?? null : null);
    setResultMapOpen(Boolean(entry.map));
    setUiMode('result');
  }, [getPool]);

  /** 새 화면으로 이동 (replace면 지금 기록을 바꾼다: 조건 수정 후 다시 추천, 칩 수정) */
  const navigate = useCallback((entry: NavEntry, replace = false) => {
    const state = { ...(window.history.state ?? {}), [NAV_KEY]: entry };
    if (replace) window.history.replaceState(state, '');
    else window.history.pushState(state, '');
    return applyNav(entry);
  }, [applyNav]);

  /**
   * 조건으로 결정 엔진을 돌리고 결과 화면으로 간다.
   * 맞는 곳이 없으면 조건을 무시한 대체 결과 대신, 결과 화면에서 칩을 빼보도록 안내한다.
   * 조건 수정 화면에서 다시 추천하면 그 기록을 새 결과로 바꿔, 뒤로가기 한 번에 직전 결과로 간다.
   */
  const runDecision = useCallback(async (
    next: IntentConditions,
    source: RecommendSource,
    notice: string | null,
    { replace = false, key }: { replace?: boolean; key?: string } = {},
  ) => {
    const mode = inferConditionMode(next) ?? contentMode;
    const modeNotice = mode !== contentMode
      ? (mode === 'space' ? '고른 장소 종류에 맞춰 볼거리에서 찾았어요.' : '고른 장소 종류에 맞춰 맛집과 카페에서 찾았어요.')
      : null;
    const snap: ResultSnapshot = {
      key: key ?? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      conditions: next,
      mode,
      notice: modeNotice ?? notice,
      source,
    };
    await navigate({ view: 'result', snap }, replace);
  }, [contentMode, navigate]);

  /** 4단계 선택 완료(지역·동행·시간·우선조건) → 결정 엔진 실행 → result 모드 전환 */
  const handleDecide = useCallback((
    region: string | null,
    companion: Companion,
    timeSlot: TimeSlot | null,
    priorityFeature: PriorityFeature,
  ) => {
    // 조건 수정이면 결과 화면 칩으로 고친 다른 조건(종류 등)은 그대로 두고, 이 화면에서 고른 것만 바꾼다
    const base = editingSnap?.conditions ?? EMPTY_CONDITIONS;
    runDecision(
      { ...base, region, companion, timeSlot, priority: priorityFeature },
      { kind: 'options' },
      null,
      { replace: Boolean(editingSnap) },
    );
  }, [editingSnap, runDecision]);

  /**
   * 첫 화면 "오늘 어디 갈까요?" 입력 → 조건 칩으로 해석 → 추천.
   * 조건 수정 중이면 문장에서 고친 항목만 바꾸고, 결과 칩으로 고친 나머지 조건은 그대로 둔다.
   */
  const handleRecommendText = useCallback(async (text: string) => {
    recordActivity('recommend_start', undefined, { contentType: contentMode });
    setIntentText(text);
    const editing = editingSnap?.source.kind === 'text' ? { snap: editingSnap, text: editingSnap.source.text } : null;
    const ruled = editing ? parseIntentText(text, regionOptions, editing.snap.mode, placeAliases) : null;
    const { conditions: parsed, source } = editing && ruled
      ? {
          conditions: applyTextEdit(
            editing.snap.conditions,
            parseIntentText(editing.text, regionOptions, editing.snap.mode, placeAliases),
            ruled,
          ),
          source: 'rules' as const,
        }
      : await resolveIntent(text, regionOptions, fetch, contentMode, placeAliases);
    const unread = source === 'rules' ? unreadWords(text, regionOptions, editing?.snap.mode ?? contentMode, placeAliases) : [];
    const notice =
      text.trim() && source === 'none'
        ? '문장에서 조건을 찾지 못했어요. 아래 칩으로 직접 골라주세요.'
        : unread.length
          ? `'${unread.join("', '")}' 조건은 아직 읽지 못해서 빼고 골랐어요. 아래 칩에 있는 조건만 적용했어요.`
          : null;
    await runDecision(parsed, { kind: 'text', text }, notice, { replace: Boolean(editingSnap) });
  }, [contentMode, regionOptions, runDecision, editingSnap, placeAliases]);

  /** 입력 없이 지역·밥집·카페로 바로 시작 */
  const handleQuickStart = useCallback((partial: Partial<IntentConditions>) => {
    recordActivity('recommend_start', undefined, { contentType: contentMode });
    runDecision({ ...EMPTY_CONDITIONS, ...partial }, { kind: 'quick' }, null, { replace: Boolean(editingSnap) });
  }, [contentMode, runDecision, editingSnap]);

  /**
   * 결과 화면에서 칩을 고치면 바로 다시 추천 (같은 결과 기록을 고친다. 처음 시작한 방식은 그대로).
   * 문장으로 시작했으면 입력 문장도 지금 조건으로 바꿔 둔다 — 조건 수정에서 지운 조건이 문장에 남아 되살아나지 않게.
   */
  const handleConditionsChange = useCallback((next: IntentConditions) => {
    if (!currentSnap) return;
    const source: RecommendSource = currentSnap.source.kind === 'text'
      ? { kind: 'text', text: conditionsToText(next, regionOptions, inferConditionMode(next) ?? contentMode) }
      : currentSnap.source;
    runDecision(next, source, null, { replace: true, key: currentSnap.key });
  }, [currentSnap, runDecision, regionOptions, contentMode]);

  /** 추천 결과의 "다른 곳 둘러보기" → 추천과 상관없는 지도·목록 탐색으로 (추천 결과는 뒤로가기로 돌아온다) */
  const handleSwitchToBrowse = useCallback(() => {
    navigate({ view: 'home', explore: true });
  }, [navigate]);

  /** 좁은 화면의 "지도로 보기" → 지금 추천과 대안을 지도로 (뒤로가기는 지도만 닫는다) */
  const handleOpenResultMap = useCallback(() => {
    if (!currentSnap) return;
    window.history.pushState({ ...(window.history.state ?? {}), [NAV_KEY]: { view: 'result', snap: currentSnap, map: true } }, '');
    setResultMapOpen(true);
  }, [currentSnap]);

  const handleCloseResultMap = useCallback(() => {
    const entry = readNavEntry(window.history.state);
    if (entry?.view === 'result' && entry.map && !entry.detailId) window.history.back();
    else setResultMapOpen(false);
  }, []);

  /** 첫 화면 ↔ 직접 찾아보기 전환은 지금 기록에 적어 둔다 (뒤로가기로 결과에서 돌아오면 보던 쪽으로) */
  const handleExploringChange = useCallback((exploring: boolean) => {
    navigate({ view: 'home', explore: exploring }, true);
  }, [navigate]);

  /** 질문형 화면·조건 수정 화면의 "돌아가기" → 들어오기 전 화면(첫 화면·직접 찾아보기·추천 결과)으로 */
  const handleBack = useCallback(() => {
    if (readNavEntry(window.history.state)?.view === 'home') {
      // 기록 없이 들어온 경우 (새로고침 등)
      navigate({ view: 'home' }, true);
      return;
    }
    window.history.back();
  }, [navigate]);

  /** 지도 탐색·첫 화면에서 하나씩 골라서 추천받기 → Decision 화면 (고르던 값은 그대로) */
  const handleBackToDecision = useCallback(() => {
    recordActivity('recommend_start', undefined, { contentType: contentMode });
    navigate({ view: 'decision' });
  }, [contentMode, navigate]);

  /** 결과 → 조건 수정: 문장으로 찾았으면 그 문장을, 하나씩 골랐으면 고른 값을 채운 입력 화면으로 */
  const handleEditConditions = useCallback(() => {
    if (!currentSnap) return;
    navigate(
      currentSnap.source.kind === 'text'
        ? { view: 'text-edit', editing: currentSnap }
        : { view: 'decision', editing: currentSnap },
    );
  }, [currentSnap, navigate]);

  /** 결과 → 처음부터 다시: 입력 문장과 조건을 지우고 첫 화면으로 (지운다는 건 버튼에 적혀 있다) */
  const handleStartOver = useCallback(() => {
    setIntentText('');
    setEntryDraft(EMPTY_DRAFT);
    setConditions(EMPTY_CONDITIONS);
    setIntentNotice(null);
    navigate({ view: 'home', explore: false });
  }, [navigate]);

  /** result 화면에서 장소 상세 보기 → 결과 화면 위에 해당 장소 상세를 연다 */
  const handleDecisionOpenDetail = useCallback((location: Location) => {
    recordActivity('list_click', location);
    if (!currentSnap) return;
    // 브라우저 뒤로가기가 결과 화면이 아니라 상세만 닫도록 기록을 하나 쌓는다
    window.history.pushState({ ...(window.history.state ?? {}), [NAV_KEY]: { view: 'result', snap: currentSnap, map: resultMapOpen, detailId: location.id } }, '');
    setResultDetail(location);
  }, [currentSnap, resultMapOpen]);

  const handleCloseResultDetail = useCallback(() => {
    const entry = readNavEntry(window.history.state);
    if (entry?.view === 'result' && entry.detailId) {
      window.history.back(); // popstate에서 닫힌다
    } else {
      setResultDetail(null);
    }
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      applyNav(readNavEntry(event.state) ?? { view: 'home' });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applyNav]);

  // 결과 화면을 떠나면 열려 있던 상세도 정리한다
  useEffect(() => {
    if (uiMode !== 'result') {
      setResultDetail(null);
      setResultMapOpen(false);
    }
  }, [uiMode]);

  // Pagination
  const handleShowMore = () => {
    setVisibleLocations(prev => prev + 10);
  };

  const handleShowAllPlaces = useCallback(() => {
    recordActivity('show_all_places', undefined, { contentType: contentMode });
    setFilters(DEFAULT_FILTER_STATE);
    setShowSavedOnly(false);
    setShowFullMapStart(true);
    setVisibleLocations(50);
  }, [contentMode]);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
    setShowFullMapStart(false);
    setVisibleLocations(10);
  }, []);

  const handleClearPlaceState = useCallback(() => {
    const confirmed = window.confirm('저장한 곳과 다녀온 곳 기록을 모두 비울까요?');
    if (!confirmed) return false;

    return clearPlaceStates().then((didSyncRemote) => {
      refreshPlaceStateIds();
      setSavedView('saved');
      setVisibleLocations(10);
      return didSyncRemote;
    });
  }, [refreshPlaceStateIds]);

  // 지도 인스턴스 저장 (Map 컴포넌트에서 호출)
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const handleMapReady = (map: kakao.maps.Map) => {
    mapRef.current = map;
  };

  // Load data on mount
  useEffect(() => {
    syncPlaceStateFromRemote().finally(refreshPlaceStateIds);
    fetchLocations();
    setFilters(DEFAULT_FILTER_STATE);
    setShowFullMapStart(false);
    setShowSavedOnly(false);
    setVisibleLocations(10);
    setUiMode('browse');
    setDecisionResult(null);
    setEditingSnap(null);
    // 새로고침·외부 지도에서 돌아온 첫 로딩이면 보던 화면을 이어 보여준다 (데이터를 받은 뒤 아래에서)
    if (initialNav.current) return;
    window.history.replaceState({ ...(window.history.state ?? {}), [NAV_KEY]: { view: 'home' } }, '');
  }, [contentMode, fetchLocations, refreshPlaceStateIds]);

  useEffect(() => {
    if (isLoading || locations.length === 0 || !initialNav.current) return;
    const entry = initialNav.current;
    initialNav.current = null;
    applyNav(entry);
  }, [isLoading, locations, applyNav]);

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
        window.history.replaceState({ [NAV_KEY]: { view: 'home', explore: true } }, '', newUrl);
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
      {uiMode !== 'browse' && (
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
      )}

      {/* ── 초기 로딩 ── */}
      {isLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white" aria-label="로딩 중" role="status">
          <div className={`h-8 w-8 animate-spin rounded-full border-2 border-gray-200 ${contentMode === 'space' ? 'border-t-violet-600' : 'border-t-orange-500'}`} />
        </div>
      )}

      {/* ── Decision Entry View (기본 진입 화면) ── */}
      {!isLoading && uiMode === 'decision' && (
        <DecisionEntryView
          key={editingSnap?.key ?? 'new'}
          contentMode={contentMode}
          availableProvincesWithDistricts={availableProvincesWithDistricts}
          onDecide={handleDecide}
          onBrowse={handleBack}
          initial={entryDraft}
          onDraftChange={setEntryDraft}
          backLabel={editingSnap ? '결과로 돌아가기' : undefined}
        />
      )}

      {/* ── Decision Result View (결정 결과 화면) ── */}
      {!isLoading && uiMode === 'result' && (
        <DecisionResultView
          result={decisionResult}
          conditions={conditions}
          onConditionsChange={handleConditionsChange}
          regionOptions={regionOptions.slice(0, 20)}
          notice={intentNotice}
          contentMode={decisionMode}
          onEditConditions={handleEditConditions}
          onStartOver={handleStartOver}
          viewKey={currentSnap?.key}
          onBrowse={handleSwitchToBrowse}
          mapOpen={resultMapOpen}
          onOpenMap={handleOpenResultMap}
          onCloseMap={handleCloseResultMap}
          onOpenDetail={handleDecisionOpenDetail}
        />
      )}

      {!isLoading && uiMode === 'result' && resultDetail && (
        <PlaceDetail
          key={resultDetail.id}
          location={resultDetail}
          onClose={handleCloseResultDetail}
          isMobile={isMobile}
          onPlaceStateChange={refreshPlaceStateIds}
        />
      )}

      {/* ── Browse View (기본 지도 탐색 UX) ── */}
      {!isLoading && uiMode === 'browse' && (
        <BrowseView
          contentMode={contentMode}
          onContentModeChange={setContentMode}
          displayedLocations={displayedLocations}
          searchableLocations={filteredLocations}
          isCuratedStart={isCuratedDisplay}
          totalLocationCount={filteredLocations.length}
          savedOnly={showSavedOnly}
          savedView={savedView}
          savedCount={savedLocationCount}
          visitedCount={visitedLocationCount}
          revisitCount={revisitLocations.length}
          myPlaceCount={myPlaceCount}
          onSavedOnlyChange={(enabled) => {
            setShowSavedOnly(enabled);
            setShowFullMapStart(false);
            setVisibleLocations(10);
          }}
          onSavedViewChange={setSavedView}
          onSavedStateChange={refreshPlaceStateIds}
          onClearPlaceState={handleClearPlaceState}
          hotRegions={hotRegions}
          onSelectHotRegion={(region) => handleDistrictChange(region)}
          onShowAllPlaces={handleShowAllPlaces}
          onResetFilters={handleResetFilters}
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
          regionOptions={regionOptions.slice(0, 20)}
          onRecommendText={handleRecommendText}
          onQuickStart={handleQuickStart}
          exploring={browseExploring}
          onExploringChange={handleExploringChange}
          intentText={intentText}
          onIntentTextChange={setIntentText}
          onCancelEdit={editingSnap ? handleBack : undefined}
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

// ─────────────────────────────────────────────
// 화면 이동 기록 (history.state)
// ─────────────────────────────────────────────

const NAV_KEY = 'oomapNav';

/** 추천을 어떻게 시작했는지. 조건 수정이 어느 입력 화면으로 갈지 정한다 */
type RecommendSource = { kind: 'text'; text: string } | { kind: 'options' } | { kind: 'quick' };

/** 추천 결과 한 번. 결과 목록 대신 조건을 남겨 두고 돌아올 때 다시 계산한다 */
interface ResultSnapshot {
  key: string;
  conditions: IntentConditions;
  mode: ContentMode;
  notice: string | null;
  source: RecommendSource;
}

type NavEntry =
  | { view: 'home'; explore?: boolean }
  | { view: 'decision'; editing?: ResultSnapshot }
  | { view: 'text-edit'; editing: ResultSnapshot }
  | { view: 'result'; snap: ResultSnapshot; detailId?: string; map?: boolean };

const EMPTY_DRAFT: EntryDraft = { region: null, companion: null, timeSlot: null, priority: null };

function readNavEntry(state: unknown): NavEntry | null {
  if (!state || typeof state !== 'object') return null;
  const entry = (state as Record<string, unknown>)[NAV_KEY];
  return entry && typeof entry === 'object' && 'view' in entry ? (entry as NavEntry) : null;
}

/** 결과의 조건을 선택 화면 값으로. 시간 없이 추천받은 결과면 '상관없어요'가 골라진 상태 */
function draftFromConditions(conditions: IntentConditions): EntryDraft {
  return {
    region: conditions.region,
    companion: conditions.companion,
    timeSlot: conditions.timeSlot ?? (conditions.companion && conditions.priority ? 'any' : null),
    priority: conditions.priority,
  };
}
