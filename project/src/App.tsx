import React, { useState, useEffect } from 'react';
import { CategoryButton } from './components/CategoryButton';
import { LocationCard } from './components/LocationCard';
import { Map } from './components/Map';
import { AddLocationModal } from './components/AddLocationModal'; // 모달 컴포넌트 불러오기
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
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [visibleLocations, setVisibleLocations] = useState<number>(10); // 표시할 장소 수
  const [isModalOpen, setIsModalOpen] = useState(false); // 모달 상태

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

  // 필터링된 장소 목록
  const filteredLocations = locations.filter(location => {
    const matchesRegion = selectedRegion === '서울 전체' || location.region === selectedRegion;
    const matchesCategory = selectedCategory === '전체' || location.category === selectedCategory;
    return matchesRegion && matchesCategory;
  });

  // 데이터 가져오기
  const fetchLocations = async () => {
    try {
      const data = await locationApi.getAll();
      setLocations(data);
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
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">밥 먹어야해</h1>
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
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              장소 목록 <span className="text-orange-500">({filteredLocations.length})</span>
            </h2>
            {filteredLocations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredLocations.slice(0, visibleLocations).map(location => (
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
            {visibleLocations < filteredLocations.length && (
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
                locations={filteredLocations}
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
