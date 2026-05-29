import { useEffect, useMemo, useRef, useState } from 'react';
import type { Location, CategoryMain, CategorySub } from '../types/location';
import { CATEGORY_HIERARCHY } from '../types/location';

interface MapProps {
  locations: Location[];
  selectedLocation: Location | null;
  highlightedLocationId?: string | null;
  onMarkerClick: (location: Location) => void;
  className?: string;
  // 사용자 위치 관련 props
  userLocation?: { lat: number; lon: number } | null;
  onMapReady?: (map: kakao.maps.Map) => void;
}

const CATEGORY_MARKER_COLORS: Record<string, { fill: string; ring: string }> = {
  '밥': { fill: '#25805F', ring: '#B7F7D8' },
  '면': { fill: '#E66A2C', ring: '#FFD5B8' },
  '국물': { fill: '#3478D7', ring: '#C8E0FF' },
  '고기요리': { fill: '#D44545', ring: '#FFD0D0' },
  '해산물': { fill: '#12859A', ring: '#BFEFF7' },
  '간편식': { fill: '#6B5DD3', ring: '#DCD8FF' },
  '양식·퓨전': { fill: '#CF5D2E', ring: '#FFD9C7' },
  '디저트': { fill: '#D94F88', ring: '#FFD1E2' },
  '카페': { fill: '#8A6246', ring: '#F2D5BD' },
  '술안주': { fill: '#2F3340', ring: '#FFE59A' },
  '볼거리': { fill: '#5F6FD9', ring: '#DCE1FF' },
  '기본': { fill: '#52606D', ring: '#D9E2EC' },
};

const CATEGORY_MARKER_ICONS: Record<string, string> = {
  '밥': '<path d="M7 3v7"/><path d="M4 3v4a3 3 0 0 0 6 0V3"/><path d="M7 10v9"/><path d="M16 3v16"/><path d="M16 3c3 2 4 6 0 9"/>',
  '면': '<path d="M5 11h14"/><path d="M7 11l1.2 7h7.6L17 11"/><path d="M8 6c2-2 6 2 8 0"/><path d="M8 3c2 2 6-2 8 0"/>',
  '국물': '<path d="M5 10h14"/><path d="M7 10c0 4 2 7 5 7s5-3 5-7"/><path d="M9 5c-1 1-1 2 0 3"/><path d="M13 4c-1 1-1 2 0 3"/><path d="M17 5c-1 1-1 2 0 3"/>',
  '고기요리': '<path d="M8 13c-2-2-2-5 0-7 2-2 5-2 7 0s2 5 0 7c-1.8 1.8-5.2 1.8-7 0Z"/><path d="M7 13l-3 3"/><path d="M4 16l2 2"/><circle cx="12" cy="9" r="2"/>',
  '해산물': '<path d="M4 12c3-4 9-4 13 0-4 4-10 4-13 0Z"/><path d="M17 12l3-3v6l-3-3Z"/><circle cx="8" cy="12" r=".7" fill="#fff" stroke="none"/>',
  '간편식': '<path d="M6 9h12"/><path d="M8 9l1 9h6l1-9"/><path d="M9 5h6l1 4H8l1-4Z"/><path d="M10 13h4"/>',
  '양식·퓨전': '<path d="M5 13c1-4 4-7 7-7s6 3 7 7"/><path d="M5 13h14"/><path d="M8 13v3"/><path d="M12 13v3"/><path d="M16 13v3"/><circle cx="12" cy="9" r="1" fill="#fff" stroke="none"/>',
  '디저트': '<path d="M7 9h10l-1 9H8L7 9Z"/><path d="M8 9c0-3 8-3 8 0"/><path d="M10 5c.5-1 1.5-1 2 0s1.5 1 2 0"/><path d="M9 13h6"/>',
  '카페': '<path d="M6 8h10v5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V8Z"/><path d="M16 10h1a2 2 0 0 1 0 4h-1"/><path d="M8 4c-1 1-1 2 0 3"/><path d="M12 4c-1 1-1 2 0 3"/>',
  '술안주': '<path d="M7 5h7v6a3.5 3.5 0 0 1-7 0V5Z"/><path d="M14 8h2a2 2 0 0 1 0 4h-2"/><path d="M10.5 14v4"/><path d="M8 18h5"/>',
  '볼거리': '<path d="M4 12s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="12" cy="12" r="2.5"/>',
  '기본': '<path d="M12 5v14"/><path d="M5 12h14"/><path d="M7 7h10v10H7z"/>',
};

const clusterStyles = [
  {
    width: '38px',
    height: '38px',
    borderRadius: '19px',
    background: 'radial-gradient(circle at 50% 50%, #FFFFFF 0 51%, #F97316 53% 61%, rgba(249,115,22,0.18) 63% 100%)',
    border: '2px solid #FFFFFF',
    boxShadow: '0 8px 20px rgba(15,23,42,0.2)',
    color: '#1F2937',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: '900',
    lineHeight: '34px',
  },
  {
    width: '46px',
    height: '46px',
    borderRadius: '23px',
    background: 'radial-gradient(circle at 50% 50%, #FFFFFF 0 49%, #25805F 51% 59%, rgba(37,128,95,0.18) 61% 100%)',
    border: '2px solid #FFFFFF',
    boxShadow: '0 10px 24px rgba(15,23,42,0.22)',
    color: '#17231D',
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: '900',
    lineHeight: '42px',
  },
  {
    width: '54px',
    height: '54px',
    borderRadius: '27px',
    background: 'radial-gradient(circle at 50% 50%, #FFFFFF 0 48%, #E66A2C 50% 57%, rgba(230,106,44,0.2) 59% 100%)',
    border: '2px solid #FFFFFF',
    boxShadow: '0 12px 28px rgba(15,23,42,0.24)',
    color: '#1F2937',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '900',
    lineHeight: '50px',
  },
];

function getCategoryMain(location: Location): string {
  if (location.categoryMain && location.categoryMain !== '전체') {
    return location.categoryMain;
  }

  if (location.categorySub) {
    for (const [main, subs] of Object.entries(CATEGORY_HIERARCHY) as [CategoryMain, CategorySub[]][]) {
      if (main !== '전체' && subs.includes(location.categorySub)) {
        return main;
      }
    }
  }

  return location.contentType === 'space' ? '볼거리' : '기본';
}

function createMarkerSvg(categoryMain: string, isSelected: boolean): string {
  const colors = CATEGORY_MARKER_COLORS[categoryMain] ?? CATEGORY_MARKER_COLORS['기본'];
  const icon = CATEGORY_MARKER_ICONS[categoryMain] ?? CATEGORY_MARKER_ICONS['기본'];
  const size = isSelected ? 46 : 38;
  const center = size / 2;
  const radius = isSelected ? 17 : 14;
  const pointerBottom = isSelected ? 44 : 36;
  const iconOffset = isSelected ? 13 : 9;
  const iconScale = isSelected ? 0.92 : 0.86;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="shadow" x="-45%" y="-35%" width="190%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.24"/>
        </filter>
      </defs>
      <path d="M${center} ${pointerBottom} C${center - 4.2} ${pointerBottom - 6.2} ${center - radius} ${center + 10} ${center - radius} ${center} A${radius} ${radius} 0 1 1 ${center + radius} ${center} C${center + radius} ${center + 10} ${center + 4.2} ${pointerBottom - 6.2} ${center} ${pointerBottom}Z" fill="${colors.ring}" opacity="0.96" filter="url(#shadow)"/>
      <circle cx="${center}" cy="${center}" r="${radius - 2.5}" fill="${colors.fill}"/>
      <circle cx="${center}" cy="${center}" r="${radius - 1.4}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.88"/>
      <g transform="translate(${iconOffset} ${iconOffset}) scale(${iconScale})" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        ${icon}
      </g>
      ${isSelected ? `<circle cx="${center}" cy="${center}" r="${radius + 2.5}" fill="none" stroke="#111827" stroke-width="2" opacity="0.9"/>` : ''}
    </svg>
  `;
}

function createMarkerImage(categoryMain: string, isSelected: boolean): kakao.maps.MarkerImage | null {
  if (typeof kakao === 'undefined' || !kakao.maps?.Size || !kakao.maps?.Point || !kakao.maps?.MarkerImage) {
    return null;
  }

  try {
    const size = isSelected ? 48 : 40;
    const svg = createMarkerSvg(categoryMain, isSelected);
    const imageSrc = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    const imageSize = new kakao.maps.Size(size, size);
    const imageOption = { offset: new kakao.maps.Point(size / 2, size - 3) };
    return new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
  } catch {
    return null;
  }
}

export function Map(props: MapProps) {
  const { locations = [], selectedLocation, onMarkerClick, className, userLocation, onMapReady } = props || {};
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const clustererRef = useRef<kakao.maps.MarkerClusterer | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const userLocationMarkerRef = useRef<kakao.maps.Marker | null>(null);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapReadyRef = useRef(onMapReady);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const isReady = mapStatus === 'ready';

  // 최신 콜백 유지
  onMarkerClickRef.current = onMarkerClick;
  onMapReadyRef.current = onMapReady;

  const selectedLocationId = selectedLocation?.id ?? null;
  const visibleLocations = useMemo(
    () => locations.filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lon)),
    [locations]
  );

  // 지도 초기화
  useEffect(() => {
    if (!mapContainer.current) return;
    setMapStatus('loading');

    const failTimer = window.setTimeout(() => {
      if (!mapRef.current) {
        setMapStatus('failed');
      }
    }, 6000);

    if (typeof kakao === 'undefined' || !kakao.maps) {
      // SDK 로드 대기
      const timer = setInterval(() => {
        if (typeof kakao !== 'undefined' && kakao.maps) {
          clearInterval(timer);
          initMap();
        }
      }, 100);
      const waitTimer = window.setTimeout(() => clearInterval(timer), 5000);
      return () => {
        clearInterval(timer);
        window.clearTimeout(waitTimer);
        window.clearTimeout(failTimer);
      };
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
        if (kakao.maps.MarkerClusterer) {
          clustererRef.current = new kakao.maps.MarkerClusterer({
            map: mapRef.current,
            averageCenter: true,
            minLevel: 6,
            gridSize: 72,
            disableClickZoom: false,
            styles: clusterStyles,
          });
        }
        setMapStatus('ready');
        
        // 카카오맵 컨테이너의 z-index 조정 (사이드바를 가리지 않도록)
        if (mapContainer.current) {
          const kakaoMapElement = mapContainer.current.querySelector('div[class*="kakao"]');
          if (kakaoMapElement && kakaoMapElement instanceof HTMLElement) {
            kakaoMapElement.style.zIndex = '0';
            kakaoMapElement.style.position = 'relative';
          }
          // 모든 자식 요소의 z-index도 조정
          setTimeout(() => {
            if (mapContainer.current) {
              const allDivs = mapContainer.current.querySelectorAll('div');
              allDivs.forEach((el) => {
                if (el instanceof HTMLElement) {
                  // 카카오맵 관련 요소인지 확인
                  if (el.id?.includes('kakao') || el.className?.includes('kakao')) {
                    el.style.zIndex = '0';
                    el.style.position = 'relative';
                  }
                  // iframe도 확인
                  if (el.tagName === 'IFRAME') {
                    el.style.zIndex = '0';
                    el.style.position = 'relative';
                  }
                }
              });
            }
          }, 500);
        }
        
        // 지도 준비 완료 시 콜백 호출
        if (onMapReadyRef.current && mapRef.current) {
          onMapReadyRef.current(mapRef.current);
        }
      } catch (e) {
        console.error('지도 초기화 오류:', e);
        setMapStatus('failed');
      }
    }

    return () => {
      window.clearTimeout(failTimer);
      // 마커 정리
      clustererRef.current?.clear();
      clustererRef.current = null;
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setMap(null);
        userLocationMarkerRef.current = null;
      }
      mapRef.current = null;
      setMapStatus('loading');
    };
  }, []);

  // 마커 업데이트
  useEffect(() => {
    if (!isReady || !mapRef.current) return;

    // 기존 마커 제거
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    clustererRef.current?.clear();

    // locations가 비어있으면 마커를 표시하지 않음
    if (visibleLocations.length === 0) {
      return;
    }

    // 새 마커 생성
    visibleLocations.forEach(location => {
      try {
        const isSelectedMarker = location.id === selectedLocationId;
        const markerImage = createMarkerImage(getCategoryMain(location), isSelectedMarker);
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(location.lat, location.lon),
          title: location.name,
          image: markerImage || undefined,
        });
        marker.setZIndex(isSelectedMarker ? 1000 : 10);

        kakao.maps.event.addListener(marker, 'click', () => {
          onMarkerClickRef.current(location);
        });

        markersRef.current.push(marker);
      } catch (e) {
        console.error('마커 생성 오류:', e);
      }
    });

    if (clustererRef.current) {
      clustererRef.current.addMarkers(markersRef.current);
    } else {
      markersRef.current.forEach(m => m.setMap(mapRef.current));
    }

    // 검색 결과가 여러 개일 때 지도 범위 조정
    if (visibleLocations.length > 0 && mapRef.current) {
      try {
        const bounds = new kakao.maps.LatLngBounds();
        visibleLocations.forEach(location => {
          bounds.extend(new kakao.maps.LatLng(location.lat, location.lon));
        });
        mapRef.current.setBounds(bounds);
      } catch (e) {
        console.error('지도 범위 조정 오류:', e);
      }
    }
  }, [isReady, visibleLocations, selectedLocationId]);

  // 사용자 위치 마커 표시
  useEffect(() => {
    if (!isReady || !mapRef.current || !userLocation) {
      // 사용자 위치가 없으면 마커 제거
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setMap(null);
        userLocationMarkerRef.current = null;
      }
      return;
    }

    try {
      // 기존 사용자 위치 마커 제거
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setMap(null);
      }

      // 사용자 위치 마커 생성 (my_icon.svg 사용)
      const userMarker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(userLocation.lat, userLocation.lon),
        image: new kakao.maps.MarkerImage(
          '/my_icon.svg',
          new kakao.maps.Size(40, 40),
          { offset: new kakao.maps.Point(20, 40) }
        ),
        zIndex: 1000, // 다른 마커 위에 표시
      });

      userMarker.setMap(mapRef.current);
      userLocationMarkerRef.current = userMarker;
    } catch (e) {
      console.error('사용자 위치 마커 생성 오류:', e);
    }
  }, [isReady, userLocation]);

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
    <div className={`${className || "w-full h-[350px] sm:h-[450px] lg:h-[500px] bg-base rounded-2xl border border-base"} relative z-0 overflow-hidden`}>
      <div
        ref={mapContainer}
        className="h-full w-full"
        style={{ zIndex: 0 }}
      />
      {mapStatus !== 'ready' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50 px-6 text-center">
          {mapStatus === 'loading' ? (
            <div>
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-orange-400" />
              <p className="mt-3 text-sm font-medium text-gray-500">지도를 불러오는 중이에요.</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-gray-700">지도를 불러오지 못했어요.</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                장소 리스트로 계속 둘러볼 수 있어요. 잠시 후 새로고침하면 지도가 다시 시도됩니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
