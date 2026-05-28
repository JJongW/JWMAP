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

const CATEGORY_MARKER_COLORS: Record<string, { fill: string; accent: string }> = {
  '밥': { fill: '#2F6F5E', accent: '#D9F99D' },
  '면': { fill: '#D97706', accent: '#FEF3C7' },
  '국물': { fill: '#2563EB', accent: '#DBEAFE' },
  '고기요리': { fill: '#B91C1C', accent: '#FEE2E2' },
  '해산물': { fill: '#0E7490', accent: '#CFFAFE' },
  '간편식': { fill: '#7C3AED', accent: '#EDE9FE' },
  '양식·퓨전': { fill: '#BE185D', accent: '#FCE7F3' },
  '디저트': { fill: '#DB2777', accent: '#FBCFE8' },
  '카페': { fill: '#5B4636', accent: '#FED7AA' },
  '술안주': { fill: '#111827', accent: '#FDE68A' },
  '볼거리': { fill: '#6D28D9', accent: '#DDD6FE' },
  '기본': { fill: '#374151', accent: '#E5E7EB' },
};

const CATEGORY_MARKER_LABELS: Record<string, string> = {
  '밥': '밥',
  '면': '면',
  '국물': '국',
  '고기요리': '고',
  '해산물': '해',
  '간편식': '간',
  '양식·퓨전': '양',
  '디저트': '디',
  '카페': '카',
  '술안주': '술',
  '볼거리': '봄',
  '기본': '장',
};

const clusterStyles = [
  {
    width: '42px',
    height: '42px',
    borderRadius: '21px',
    background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
    border: '2px solid rgba(255,255,255,0.94)',
    boxShadow: '0 10px 24px rgba(17,24,39,0.24)',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: '800',
    lineHeight: '39px',
  },
  {
    width: '50px',
    height: '50px',
    borderRadius: '25px',
    background: 'linear-gradient(135deg, #EA580C 0%, #111827 78%)',
    border: '2px solid rgba(255,255,255,0.94)',
    boxShadow: '0 14px 28px rgba(17,24,39,0.28)',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '800',
    lineHeight: '47px',
  },
  {
    width: '58px',
    height: '58px',
    borderRadius: '29px',
    background: 'linear-gradient(135deg, #F97316 0%, #111827 72%)',
    border: '3px solid rgba(255,255,255,0.96)',
    boxShadow: '0 16px 32px rgba(17,24,39,0.32)',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: '15px',
    fontWeight: '900',
    lineHeight: '53px',
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
  const label = CATEGORY_MARKER_LABELS[categoryMain] ?? CATEGORY_MARKER_LABELS['기본'];
  const size = isSelected ? 48 : 40;
  const center = size / 2;
  const radius = isSelected ? 15 : 13;
  const textY = isSelected ? 24.5 : 21.5;
  const pointerTop = isSelected ? 33 : 27.5;
  const pointerBottom = isSelected ? 45 : 37;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="shadow" x="-40%" y="-30%" width="180%" height="190%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#111827" flood-opacity="0.28"/>
        </filter>
      </defs>
      <path d="M${center} ${pointerBottom} C${center - 3.8} ${pointerBottom - 5.2} ${center - radius} ${pointerTop} ${center - radius} ${center} A${radius} ${radius} 0 1 1 ${center + radius} ${center} C${center + radius} ${pointerTop} ${center + 3.8} ${pointerBottom - 5.2} ${center} ${pointerBottom}Z" fill="${colors.fill}" filter="url(#shadow)"/>
      <circle cx="${center}" cy="${center}" r="${radius - 4}" fill="${colors.accent}" opacity="0.96"/>
      <text x="${center}" y="${textY}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="${isSelected ? 11 : 10}" font-weight="800" fill="${colors.fill}">${label}</text>
      <circle cx="${center + radius - 2}" cy="${center - radius + 2}" r="${isSelected ? 4 : 3.5}" fill="#FFFFFF" opacity="0.92"/>
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
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const isReady = mapStatus === 'ready';

  // 최신 콜백 유지
  onMarkerClickRef.current = onMarkerClick;

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
        if (onMapReady && mapRef.current) {
          onMapReady(mapRef.current);
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
