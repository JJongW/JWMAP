import { useState, useEffect, useRef } from 'react';
import { CategoryButton } from './components/CategoryButton';
import { LocationCard } from './components/LocationCard';
import { Map } from './components/Map';
import { AddLocationModal } from './components/AddLocationModal'; // 모달 컴포넌트 불러오기
import { EventBanner } from './components/EventBanner'; // 이벤트 배너 컴포넌트
import { TopSearchBar } from './components/TopSearchBar'; // LLM 검색 바
import type { Region, Category, Location } from './types/location';
import { MapPin, Plus, Star } from 'lucide-react';
import { Footer } from './components/Footer';
import { locationApi } from './utils/supabase';
import { SpeedInsights } from "@vercel/speed-insights/react"

export default function App() {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [locations, setLocations] = useState<Location[]>([]); // 전체 장소 데이터
  const [selectedRegion, setSelectedRegion] = useState<Region | '서울 전체'>('서울 전체');
  const [selectedCategory, setSelectedCategory] = useState<Category | '전체'>('전체');
  const [selectedEventTag, setSelectedEventTag] = useState<string | null>(null); // 선택된 이벤트 태그
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [visibleLocations, setVisibleLocations] = useState<number>(10); // 표시할 장소 수
  const [isModalOpen, setIsModalOpen] = useState(false); // 모달 상태

  // LLM 검색 관련 상태
  const [isSearchMode, setIsSearchMode] = useState(false); // 검색 모드 여부
  const [searchResults, setSearchResults] = useState<Location[]>([]); // 검색 결과
  const preFilteredListRef = useRef<Location[]>([]); // 검색 전 필터된 리스트 저장

  // 이벤트 목록 정의 - 필요에 따라 확장 가능
  const eventList = [
    { name: '흑백요리사 시즌2 식당', tag: '흑백요리사 시즌2' },
    { name: '천하제빵 시즌 1 베이커리(더 추가 예정)', tag: '천하제빵 시즌1' }
  ];

  // 지역 목록과 카테고리 목록
  const regions: (Region | '서울 전체')[] = ['서울 전체', ...Array.from(new Set(locations.map(l => l.region)))];
  const categories: (Category | '전체')[] = [
    '전체',
    ...Array.from(
      new Set(
        locations
          .filter(location => selectedRegion === '서울 전체' || location.region === selectedRegion)
          .map(l => l.category)
      )
    ),
  ];

  // 필터링된 장소 목록 - 이벤트 태그 필터 추가
  const filteredLocations = locations.filter(location => {
    const matchesRegion = selectedRegion === '서울 전체' || location.region === selectedRegion;
    const matchesCategory = selectedCategory === '전체' || location.category === selectedCategory;
    // 이벤트 태그가 선택된 경우, 해당 태그를 가진 장소만 필터링
    const matchesEvent = !selectedEventTag || 
      (location.eventTags && location.eventTags.includes(selectedEventTag));
    return matchesRegion && matchesCategory && matchesEvent;
  });

  // 이벤트별 장소 개수 계산
  const getEventLocationCount = (eventTag: string) => {
    return locations.filter(location => 
      location.eventTags && location.eventTags.includes(eventTag)
    ).length;
  };

  // 데이터 가져오기
  const fetchLocations = async () => {
    try {
      const data = await locationApi.getAll();
      setLocations(data);
      
      // 디버깅: 이벤트 태그가 있는 장소 확인
      const locationsWithEvents = data.filter(loc => loc.eventTags && loc.eventTags.length > 0);
      if (locationsWithEvents.length > 0) {
        console.log('이벤트 태그가 있는 장소:', locationsWithEvents);
        console.log('이벤트 태그 목록:', locationsWithEvents.map(loc => ({ name: loc.name, tags: loc.eventTags })));
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };
  
  // 새로운 장소 추가
  const handleAddLocation = async (newLocation: {
    name: string;
    region: string;
    category: string;
    address: string;
    imageUrl: string;
    rating: number;
    lon: number;
    lat: number;
  }) => {
    try {
      const data = await locationApi.create(newLocation as Omit<Location, 'id'>);
      setLocations(prev => [...prev, data]); // 상태 업데이트
      alert('새로운 장소가 추가되었습니다.');
    } catch (error) {
      console.error('Error adding location:', error);
      alert('새로운 장소 추가 중 문제가 발생했습니다.');
    }
  };

  // 장소 삭제
  const handleDelete = async (id: string) => {
    try {
      await locationApi.delete(id);
      setLocations(prev => prev.filter(location => location.id !== id));
      alert('장소가 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('장소 삭제 중 문제가 발생했습니다.');
    }
  };

  // "더 보기" 버튼 클릭
  const handleShowMore = () => {
    setVisibleLocations(prev => prev + 10);
  };

  // LLM 검색 결과 처리
  const handleSearchResults = (places: Location[]) => {
    // 검색 전 현재 필터된 리스트 저장 (복원용)
    if (!isSearchMode) {
      preFilteredListRef.current = filteredLocations;
    }
    setSearchResults(places);
    setIsSearchMode(true);
    setVisibleLocations(10);
  };

  // 검색 결과에서 장소 선택
  const handleSearchSelect = (placeId: string) => {
    const place = searchResults.find(p => p.id === placeId);
    if (place) {
      setSelectedLocation(place);
    }
  };

  // 검색 모드 해제, 필터 뷰로 복귀
  const handleSearchReset = () => {
    setIsSearchMode(false);
    setSearchResults([]);
    setVisibleLocations(10);
    setSelectedLocation(null);
  };

  // 검색 모드일 때 표시할 목록
  const displayedLocations = isSearchMode ? searchResults : filteredLocations;

  const handleResize = () => {
    setIsMobile(window.innerWidth <= 768); // 모바일 기준: 768px 이하
  };

  // 데이터 로드
  useEffect(() => {
    fetchLocations();
    handleResize(); // 초기화
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 서비스 로고 아이콘 - 오렌지 배경에 흰색 'qd' 로고 */}
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center overflow-hidden">
                <img 
                  src="/logo.svg" 
                  alt="오늘 오디가? 로고" 
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-xl font-bold text-gray-900 font-sans">오늘 오디가?</h1>
            </div>
            <button
              className="px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors flex items-center gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={18} />
              <span className="hidden sm:inline">새로운 장소 추가</span>
              <span className="sm:hidden">추가</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* AddLocationModal */}
        {isModalOpen && (
          <AddLocationModal
            onClose={() => setIsModalOpen(false)}
            onSave={handleAddLocation}
          />
        )}
        <div className="space-y-6">
          {/* LLM 자연어 검색 바 */}
          <TopSearchBar
            onResults={handleSearchResults}
            onSelect={handleSearchSelect}
            onReset={handleSearchReset}
            isSearchMode={isSearchMode}
          />

          {/* 이벤트 배너 섹션 - 지역 필터 위에 배치 */}
          {eventList.length > 0 && eventList.map(event => {
            const eventCount = getEventLocationCount(event.tag);
            // 이벤트 배너는 항상 표시 (장소가 없어도 배너는 보여줌)
            
            return (
              <EventBanner
                key={event.tag}
                eventName={event.name}
                eventCount={eventCount}
                isActive={selectedEventTag === event.tag}
                onActivate={() => {
                  setSelectedEventTag(event.tag);
                  setVisibleLocations(10); // 필터 변경 시 목록 초기화
                  // 이벤트 활성화 시 리스트로 자동 스크롤
                  setTimeout(() => {
                    const listElement = document.querySelector('[data-location-list]');
                    if (listElement) {
                      listElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                onDeactivate={() => {
                  setSelectedEventTag(null);
                  setVisibleLocations(10); // 필터 해제 시 목록 초기화
                }}
              />
            );
          })}

          {/* 필터 섹션 */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">지역</h2>
            <div className="flex flex-wrap gap-2">
              {regions.map(region => (
                <CategoryButton
                  key={region}
                  category={region}
                  isActive={selectedRegion === region}
                  onClick={() => {
                    setSelectedRegion(region);
                    setSelectedCategory('전체');
                    setSelectedEventTag(null); // 지역 변경 시 이벤트 필터 해제
                  }}
                  count={locations.filter(l => region === '서울 전체' || l.region === region).length}
                />
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">종류</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <CategoryButton
                  key={category}
                  category={category}
                  isActive={selectedCategory === category}
                  onClick={() => setSelectedCategory(category)}
                  count={locations.filter(
                    l =>
                      (selectedRegion === '서울 전체' || l.region === selectedRegion) &&
                      (category === '전체' || l.category === category)
                  ).length}
                />
              ))}
            </div>
          </div>

          {/* 장소 리스트 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5" data-location-list>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              장소 목록 <span className="text-orange-500">({displayedLocations.length})</span>
              {isSearchMode && (
                <span className="ml-2 text-blue-500 text-xs font-normal">
                  - 검색 결과
                </span>
              )}
              {!isSearchMode && selectedEventTag && (
                <span className="ml-2 text-orange-500 text-xs font-normal">
                  - {eventList.find(e => e.tag === selectedEventTag)?.name} 필터 적용 중
                </span>
              )}
            </h2>
            {displayedLocations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {displayedLocations.slice(0, visibleLocations).map(location => (
                  <div
                    key={location.id}
                    className={`rounded-2xl cursor-pointer transition-all overflow-hidden ${
                      selectedLocation?.id === location.id
                        ? 'ring-2 ring-orange-400 shadow-lg'
                        : 'hover:shadow-md border border-gray-100'
                    }`}
                    onClick={() => setSelectedLocation(location)}
                  >
                    {/* 이미지 */}
                    <div className="relative h-32 bg-gray-100">
                      {location.imageUrl ? (
                        <img
                          src={location.imageUrl}
                          alt={location.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MapPin className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      {/* 카테고리 뱃지 */}
                      <span className="absolute top-2 left-2 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded-lg">
                        {location.category}
                      </span>
                    </div>
                    {/* 컨텐츠 */}
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 truncate">{location.name}</h3>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-500 truncate flex-1">{location.region}</p>
                        <div className="flex items-center gap-1 text-orange-500">
                          <Star size={12} className="fill-current" />
                          <span className="text-xs font-semibold">{location.rating?.toFixed(1) || '0.0'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-8">조건에 맞는 장소가 없습니다.</div>
            )}
            {visibleLocations < displayedLocations.length && (
              <div className="text-center mt-6">
                <button
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                  onClick={handleShowMore}
                >
                  더 보기
                </button>
              </div>
            )}
          </div>

          {/* 지도 & 카드 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Map
                locations={displayedLocations}
                selectedLocation={selectedLocation}
                onMarkerClick={setSelectedLocation}
              />
            </div>
            <div>
              {selectedLocation ? (
                <LocationCard location={selectedLocation} onDelete={handleDelete} />
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500">지도에서 장소를 선택해주세요</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <SpeedInsights/>
      </main>
      <Footer /> {/* Footer 컴포넌트 추가 */}
    </div>
  );
}
