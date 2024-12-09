import React, { useEffect, useRef, useState } from 'react';
import type { Location } from '../types/location';

interface MapProps {
  locations: Location[];
  selectedLocation: Location | null;
  onMarkerClick: (location: Location) => void;
}

export function Map({ locations, selectedLocation, onMarkerClick }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null); // 지도 컨테이너 참조
  const mapInstance = useRef<kakao.maps.Map | null>(null); // Kakao Map 인스턴스
  const markers = useRef<kakao.maps.Marker[]>([]); // 지도에 표시된 마커들
  const [isScriptLoaded, setIsScriptLoaded] = useState(false); // 스크립트 로드 상태

  // Kakao Maps 스크립트 동적 로드
  const loadKakaoMapScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (document.getElementById('kakao-map-script')) {
        setIsScriptLoaded(true); // 이미 로드된 경우
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'kakao-map-script';
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_API_KEY}&libraries=services,clusterer,drawing`;
      script.onload = () => {
        setIsScriptLoaded(true); // 로드 완료
        resolve();
      };
      script.onerror = () => reject(new Error('Kakao Maps API 로드 실패'));
      document.head.appendChild(script);
    });
  };

  useEffect(() => {
    loadKakaoMapScript()
      .then(() => {
        if (!mapContainer.current) return;

        // 지도 생성
        const mapOptions = {
          center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 시청 기본 좌표
          level: 5, // 기본 줌 레벨
        };
        mapInstance.current = new kakao.maps.Map(mapContainer.current, mapOptions);

        // 마커 추가
        locations.forEach((location) => {
          const marker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(location.lat, location.lon),
            title: location.name,
          });
          marker.setMap(mapInstance.current);

          // 마커 클릭 이벤트
          kakao.maps.event.addListener(marker, 'click', () => {
            onMarkerClick(location); // 선택된 장소 업데이트
          });

          markers.current.push(marker);
        });
      })
      .catch((error) => console.error(error));

    return () => {
      markers.current.forEach((marker) => marker.setMap(null)); // 기존 마커 제거
      markers.current = [];
    };
  }, [locations, onMarkerClick]);

  useEffect(() => {
    if (isScriptLoaded && selectedLocation && mapInstance.current) {
      const moveLatLng = new kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lon);
      mapInstance.current.setLevel(3); // 줌 레벨 조정
      mapInstance.current.panTo(moveLatLng); // 지도 중심 이동
    }
  }, [isScriptLoaded, selectedLocation]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-[600px] bg-gray-100 rounded-lg"
    />
  );
}
