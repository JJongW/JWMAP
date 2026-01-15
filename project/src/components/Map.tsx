import { useEffect, useRef, useState } from 'react';
import type { Location } from '../types/location';

interface MapProps {
  locations: Location[];
  selectedLocation: Location | null;
  highlightedLocationId?: string | null;
  onMarkerClick: (location: Location) => void;
  className?: string;
}

// 카테고리별 마커 이미지 캐시
const markerImageCache: Record<string, kakao.maps.MarkerImage> = {};

function getMarkerImage(category: string): kakao.maps.MarkerImage | undefined {
  if (markerImageCache[category]) {
    return markerImageCache[category];
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
    const imageSize = new kakao.maps.Size(64, 69);
    const imageOption = { offset: new kakao.maps.Point(27, 69) };
    const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
    markerImageCache[category] = markerImage;
    return markerImage;
  }

  return undefined;
}

export function Map({ locations, selectedLocation, highlightedLocationId, onMarkerClick, className }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<kakao.maps.Map | null>(null);
  const clustererRef = useRef<any>(null);
  const markersRef = useRef<Map<string, kakao.maps.Marker>>(new Map());
  const locationMapRef = useRef<Map<string, Location>>(new Map());
  const onMarkerClickRef = useRef(onMarkerClick);
  const [isMapReady, setIsMapReady] = useState(false);

  // onMarkerClick 최신 참조 유지
  onMarkerClickRef.current = onMarkerClick;

  // 지도 초기화
  useEffect(() => {
    if (!mapContainer.current) return;

    try {
      const mapOptions = {
        center: new kakao.maps.LatLng(37.5665, 126.9780),
        level: 5,
      };
      mapInstance.current = new kakao.maps.Map(mapContainer.current, mapOptions);

      // 마커 클러스터러 생성
      if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.MarkerClusterer) {
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map: mapInstance.current,
          averageCenter: true,
          minLevel: 6,
          disableClickZoom: false,
          styles: [{
            width: '53px',
            height: '52px',
            background: 'rgba(249, 115, 22, 0.9)',
            borderRadius: '50%',
            color: '#fff',
            textAlign: 'center',
            fontWeight: 'bold',
            lineHeight: '52px',
            fontSize: '14px',
          }],
        });
      }

      setIsMapReady(true);
    } catch (e) {
      console.error('지도 초기화 오류:', e);
    }

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clear();
        clustererRef.current = null;
      }
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current.clear();
      locationMapRef.current.clear();
      mapInstance.current = null;
      setIsMapReady(false);
    };
  }, []);

  // 마커 업데이트 - 지도가 준비된 후에만 실행
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;

    const currentMarkers = markersRef.current;
    const currentLocationIds = new Set(locations.map(l => l.id));
    const existingIds = new Set(currentMarkers.keys());

    // 삭제할 마커
    const toRemove: kakao.maps.Marker[] = [];
    existingIds.forEach(id => {
      if (!currentLocationIds.has(id)) {
        const marker = currentMarkers.get(id);
        if (marker) {
          toRemove.push(marker);
          marker.setMap(null);
          currentMarkers.delete(id);
          locationMapRef.current.delete(id);
        }
      }
    });

    if (toRemove.length > 0 && clustererRef.current) {
      try {
        clustererRef.current.removeMarkers(toRemove);
      } catch (e) { /* ignore */ }
    }

    // 추가할 마커
    const newMarkers: kakao.maps.Marker[] = [];
    locations.forEach(location => {
      locationMapRef.current.set(location.id, location);

      if (!existingIds.has(location.id)) {
        const markerImage = getMarkerImage(location.category);
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(location.lat, location.lon),
          title: location.name,
          image: markerImage,
        });

        const locationId = location.id;
        kakao.maps.event.addListener(marker, 'click', () => {
          const loc = locationMapRef.current.get(locationId);
          if (loc) {
            onMarkerClickRef.current(loc);
          }
        });

        currentMarkers.set(location.id, marker);
        newMarkers.push(marker);

        // 클러스터러가 없으면 직접 지도에 추가
        if (!clustererRef.current) {
          marker.setMap(mapInstance.current);
        }
      }
    });

    if (newMarkers.length > 0 && clustererRef.current) {
      try {
        clustererRef.current.addMarkers(newMarkers);
      } catch (e) {
        newMarkers.forEach(marker => marker.setMap(mapInstance.current));
      }
    }
  }, [isMapReady, locations]);

  // 선택된 위치로 이동
  useEffect(() => {
    if (selectedLocation && mapInstance.current) {
      const moveLatLng = new kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lon);
      mapInstance.current.setLevel(3);
      mapInstance.current.panTo(moveLatLng);
    }
  }, [selectedLocation]);

  // 하이라이트
  useEffect(() => {
    if (!highlightedLocationId) return;

    const marker = markersRef.current.get(highlightedLocationId);
    if (marker) {
      marker.setZIndex(10);
    }

    return () => {
      if (marker) {
        marker.setZIndex(0);
      }
    };
  }, [highlightedLocationId]);

  return (
    <div
      ref={mapContainer}
      className={className || "w-full h-[350px] sm:h-[450px] lg:h-[500px] bg-gray-100 rounded-2xl border border-gray-100"}
    />
  );
}
