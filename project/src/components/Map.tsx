import { useEffect, useRef, useState } from 'react';
import type { Location } from '../types/location';

interface MapProps {
  locations: Location[];
  selectedLocation: Location | null;
  highlightedLocationId?: string | null;
  onMarkerClick: (location: Location) => void;
  className?: string;
}

// 카테고리별 마커 이미지 생성
function createMarkerImage(category: string): kakao.maps.MarkerImage | null {
  if (typeof kakao === 'undefined' || !kakao.maps?.Size || !kakao.maps?.Point || !kakao.maps?.MarkerImage) {
    return null;
  }

  let imageSrc: string | null = null;

  if (category === '라멘') {
    imageSrc = '/ramen-marker.svg';
  } else if (category === '카공카페') {
    imageSrc = '/note-marker.svg';
  } else if (category === '카페') {
    imageSrc = '/cafe-marker.svg';
  }

  if (imageSrc) {
    try {
      const imageSize = new kakao.maps.Size(64, 69);
      const imageOption = { offset: new kakao.maps.Point(27, 69) };
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
        // categorySub 우선, 없으면 categoryMain 사용
        const categoryForMarker = location.categorySub || location.categoryMain || '';
        const markerImage = createMarkerImage(categoryForMarker);
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
