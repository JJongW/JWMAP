import React, { useState, useEffect } from 'react';
import { CategoryButton } from './components/CategoryButton';
import { LocationCard } from './components/LocationCard';
import { Map } from './components/Map';
import { AddLocationModal } from './components/AddLocationModal'; // 모달 컴포넌트 불러오기
import type { Region, Category, Location } from './types/location';
import { MapPin, Plus } from 'lucide-react';
import { Footer } from './components/Footer';
import apiClient from './utils/apiClient';
import { SpeedInsights } from "@vercel/speed-insights/react"

export default function App() {
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
      const response = await apiClient.get('/api/locations');
      setLocations(response.data);
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
      const response = await apiClient.post('/api/locations', newLocation);
      setLocations(prev => [...prev, response.data]); // 상태 업데이트
      alert('새로운 장소가 추가되었습니다.');
    } catch (error) {
      console.error('Error adding location:', error);
      alert('새로운 장소 추가 중 문제가 발생했습니다.');
    }
  };

  // 장소 삭제
  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/locations/${id}`);
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

  // 데이터 로드
  useEffect(() => {
    fetchLocations();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-6 h-6 text-red-600" />
              <h1 className="text-2xl font-bold text-gray-900">종원의 서울 맛집 지도</h1>
            </div>
            <button
              className="px-4 py-2 bg-gradient-to-r from-green-400 to-red-500 text-white rounded-lg shadow hover:bg-blue-600 flex items-center gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={16} />
              새로운 장소 추가
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 grid grid-cols-8 gap-6">
        {/* AddLocationModal */}
        {isModalOpen && (
          <AddLocationModal
            onClose={() => setIsModalOpen(false)}
            onSave={handleAddLocation}
          />
        )}
        <div className="col-span-1">
          <ins className="kakao_ad_area" style={{display:"none"}}
              data-ad-unit = "DAN-2SvmyGR7uLI3OKmD"
              data-ad-width = "160"
              data-ad-height = "600"></ins>
        </div>
        <div className="col-span-7 space-y-6">]
          {/* 지역 선택 */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold mb-3">지역</h2>
            <div className="flex flex-wrap gap-2">
              {regions.map(region => (
                <CategoryButton
                  key={region}
                  category={region}
                  isActive={selectedRegion === region}
                  onClick={() => {
                    setSelectedRegion(region);
                    setSelectedCategory('전체'); // 지역 변경 시 카테고리 초기화
                  }}
                  count={locations.filter(l => region === '서울 전체' || l.region === region).length}
                />
              ))}
            </div>
          </div>

          {/* 카테고리 선택 */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold mb-3">종류</h2>
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
          <div className="bg-white rounded-lg shadow-md p-4 space-y-4 lg:col-span-1">
            <h2 className="text-lg font-semibold">장소 목록</h2>
            {filteredLocations.length > 0 ? (
              <ul className="space-y-2">
                {filteredLocations.slice(0, visibleLocations).map(location => (
                  <li
                    key={location.id}
                    className={`p-3 rounded-lg shadow-sm cursor-pointer transition-all ${
                      selectedLocation?.id === location.id
                        ? 'bg-blue-100 border-blue-400 border'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedLocation(location)}
                  >
                    <div className="font-medium text-gray-800">{location.name}</div>
                    <div className="text-sm text-gray-600">{location.address}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-600 text-center">조건에 맞는 장소가 없습니다.</div>
            )}
            {visibleLocations < filteredLocations.length && (
              <div className="text-center mt-4">
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  onClick={handleShowMore}
                >
                  더 보기
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <div className="bg-white rounded-lg shadow-md p-4 text-center text-gray-600">
                  지도에서 장소를 선택해주세요
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
