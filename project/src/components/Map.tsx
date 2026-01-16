import { useEffect, useRef, useState } from 'react';
import type { Location, CategoryMain, CategorySub } from '../types/location';
import { CATEGORY_HIERARCHY } from '../types/location';

interface MapProps {
  locations: Location[];
  selectedLocation: Location | null;
  highlightedLocationId?: string | null;
  onMarkerClick: (location: Location) => void;
  className?: string;
}

// 카테고리 대분류별 마커 이미지 생성
function createMarkerImage(categoryMain: string): kakao.maps.MarkerImage | null {
  if (typeof kakao === 'undefined' || !kakao.maps?.Size || !kakao.maps?.Point || !kakao.maps?.MarkerImage) {
    return null;
  }

  const markerMap: Record<string, string> = {
    '밥': '/rice_marker.svg',
    '면': '/noodle_marker.svg',
    '국물': '/bowl_marker.svg',
    '고기요리': '/beef_marker.svg',
    '해산물': '/fish_marker.svg',
    '간편식': '/fast_marker.svg',
    '양식·퓨전': '/sushi_marker.svg',
    '디저트': '/desert_marker.svg',
    '카페': '/cafe_marker.svg',
    '술안주': '/beer_marker.svg',
  };

  const imageSrc = markerMap[categoryMain];

  if (imageSrc) {
    try {
      // 마커 크기 축소 (64x69 -> 48x52)
      const imageSize = new kakao.maps.Size(48, 52);
      const imageOption = { offset: new kakao.maps.Point(24, 52) };
      return new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
    } catch {
      return null;
    }
  }

  return null;
}

export function Map(props: MapProps) {
  const { locations = [], selectedLocation, onMarkerClick, className } = props || {};
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const [isReady, setIsReady] = useState(false);

  // 최신 콜백 유지
  onMarkerClickRef.current = onMarkerClick;

  // 지도 초기화
  useEffect(() => {
    if (!mapContainer.current) return;
    if (typeof kakao === 'undefined' || !kakao.maps) {
      // SDK 로드 대기
      const timer = setInterval(() => {
        if (typeof kakao !== 'undefined' && kakao.maps) {
          clearInterval(timer);
          initMap();
        }
      }, 100);
      setTimeout(() => clearInterval(timer), 5000);
      return () => clearInterval(timer);
    } else {
      initMap();
    }

    function initMap() {
      if (!mapContainer.current || mapRef.current) return;

      try {
        const options = {
          center: new kakao.maps.LatLng(37.5665, 126.9780),
          level: 5,
        };
        mapRef.current = new kakao.maps.Map(mapContainer.current, options);
        setIsReady(true);
      } catch (e) {
        console.error('지도 초기화 오류:', e);
      }
    }

    return () => {
      // 마커 정리
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
      setIsReady(false);
    };
  }, []);

  // 마커 업데이트
  useEffect(() => {
    if (!isReady || !mapRef.current) return;

    // 기존 마커 제거
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // 새 마커 생성
    locations.forEach(location => {
      try {
        // categoryMain을 기준으로 마커 이미지 선택
        // categoryMain이 없으면 categorySub로부터 역추론
        let categoryMain = location.categoryMain;
        if (!categoryMain && location.categorySub) {
          // categorySub로부터 대분류 역추론
          for (const [main, subs] of Object.entries(CATEGORY_HIERARCHY) as [CategoryMain, CategorySub[]][]) {
            if (main !== '전체' && subs.includes(location.categorySub)) {
              categoryMain = main;
              break;
            }
          }
        }
        
        const markerImage = createMarkerImage(categoryMain || '');
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(location.lat, location.lon),
          title: location.name,
          image: markerImage || undefined,
        });

        // 마커를 지도에 추가
        marker.setMap(mapRef.current);

        // 클릭 이벤트 리스너 추가
        kakao.maps.event.addListener(marker, 'click', () => {
          onMarkerClickRef.current(location);
        });

        markersRef.current.push(marker);
      } catch (e) {
        console.error('마커 생성 오류:', e);
      }
    });
  }, [isReady, locations]);

  // 선택된 위치로 이동
  useEffect(() => {
    if (!isReady || !mapRef.current || !selectedLocation) return;

    try {
      const moveLatLng = new kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lon);
      mapRef.current.setLevel(3);
      mapRef.current.panTo(moveLatLng);
    } catch (e) {
      console.error('지도 이동 오류:', e);
    }
  }, [isReady, selectedLocation]);

  return (
    <div
      ref={mapContainer}
      className={className || "w-full h-[350px] sm:h-[450px] lg:h-[500px] bg-gray-100 rounded-2xl border border-gray-100"}
    />
  );
}
