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

    // 마커 추가 - 라멘, 카공카페, 카페 카테고리는 특별한 마커 사용
    locations.forEach(location => {
      let markerImage: kakao.maps.MarkerImage | undefined = undefined;
      
      // 라멘 카테고리인 경우 커스텀 마커 이미지 사용
      if (location.category === '라멘') {
        // Vite에서는 public 폴더의 파일이 루트 경로로 제공됨
        const imageSrc = '/ramen-marker.svg'; // 라멘 마커 이미지 경로
        const imageSize = new kakao.maps.Size(64, 69); // 마커 이미지 크기
        const imageOption = { offset: new kakao.maps.Point(27, 69) }; // 마커의 좌표와 일치시킬 이미지 안에서의 좌표
        markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
      }
      // 카공카페 카테고리인 경우 note-marker.svg 사용
      else if (location.category === '카공카페') {
        const imageSrc = '/note-marker.svg'; // 카공카페 마커 이미지 경로
        const imageSize = new kakao.maps.Size(64, 69); // 마커 이미지 크기
        const imageOption = { offset: new kakao.maps.Point(27, 69) }; // 마커의 좌표와 일치시킬 이미지 안에서의 좌표
        markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
      }
      // 카페 카테고리인 경우 cafe-marker.svg 사용
      else if (location.category === '카페') {
        const imageSrc = '/cafe-marker.svg'; // 카페 마커 이미지 경로
        const imageSize = new kakao.maps.Size(64, 69); // 마커 이미지 크기
        const imageOption = { offset: new kakao.maps.Point(27, 69) }; // 마커의 좌표와 일치시킬 이미지 안에서의 좌표
        markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
      }

      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(location.lat, location.lon), // 올바른 좌표 순서
        title: location.name,
        image: markerImage, // 라멘, 카공카페, 카페 카테고리일 때 커스텀 마커 이미지 사용
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

  return <div ref={mapContainer} className="w-full h-[350px] sm:h-[450px] lg:h-[500px] bg-gray-100 rounded-2xl border border-gray-100" />;
}