import React, { useEffect, useRef } from 'react';
import type { Location } from '../types/location';

interface MapProps {
  locations: Location[];
  selectedLocation: Location | null;
  onMarkerClick: (location: Location) => void;
}

export function Map({ locations, selectedLocation, onMarkerClick }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<kakao.maps.Map | null>(null);
  const markers = useRef<kakao.maps.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    // 지도 생성
    const mapOptions = {
      center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 시청 기본 좌표
      level: 5, // 기본 줌 레벨
    };
    mapInstance.current = new kakao.maps.Map(mapContainer.current, mapOptions);

    // 마커 추가
    locations.forEach(location => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(location.lat, location.lon), // 올바른 좌표 순서
        title: location.name,
      });
      marker.setMap(mapInstance.current);

      // 마커 클릭 이벤트
      kakao.maps.event.addListener(marker, 'click', () => {
        onMarkerClick(location); // 클릭 시 선택된 장소로 상태 업데이트
      });

      markers.current.push(marker);
    });

    return () => {
      markers.current.forEach(marker => marker.setMap(null)); // 마커 제거
      markers.current = [];
    };
  }, [locations, onMarkerClick]);

  useEffect(() => {
    if (selectedLocation && mapInstance.current) {
      const moveLatLng = new kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lon);
      mapInstance.current.setLevel(3); // 줌 레벨 조정
      mapInstance.current.panTo(moveLatLng); // 지도 중심 이동
    }
  }, [selectedLocation]);

  return <div ref={mapContainer} className="w-full h-[600px] bg-gray-100 rounded-lg" />;
}