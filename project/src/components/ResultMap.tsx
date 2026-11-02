/**
 * ResultMap.tsx
 *
 * 데스크톱 추천 결과 오른쪽 지도. 추천 1곳과 대안을 번호 라벨로 찍어 한 화면에 담는다.
 * 라벨을 누르면 카드와 같은 장소 상세를 연다. 모바일에서는 그리지 않는다 (지도 앱 버튼이 그 역할).
 */

import { useEffect, useRef } from 'react';
import type { Location } from '../types/location';

interface ResultMapProps {
  /** 0번이 추천 1곳, 나머지는 대안 순서. unconfirmed면 고른 조건 중 확인 안 된 것이 있는 후보 */
  places: { location: Location; unconfirmed: boolean }[];
  onOpenDetail: (location: Location) => void;
}

function hasKakaoMaps() {
  const maps = (window as unknown as { kakao?: { maps?: { LatLng?: unknown } } }).kakao?.maps;
  return typeof maps?.LatLng === 'function';
}

export function ResultMap({ places, onOpenDetail }: ResultMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(onOpenDetail);
  openRef.current = onOpenDetail;
  const placed = places.filter(({ location }) => Number.isFinite(location.lat) && Number.isFinite(location.lon) && location.lat !== 0);
  const key = placed.map(({ location, unconfirmed }) => `${location.id}:${unconfirmed}`).join(',');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasKakaoMaps() || placed.length === 0) return;

    const map = new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(placed[0].location.lat, placed[0].location.lon),
      level: 5,
    });
    const bounds = new kakao.maps.LatLngBounds();
    const overlays = placed.map(({ location: place, unconfirmed }, index) => {
      const position = new kakao.maps.LatLng(place.lat, place.lon);
      bounds.extend(position);
      const label = document.createElement('button');
      label.type = 'button';
      // 역할과 장소명을 '추천: 장소명'처럼 나눈다. 조건이 확인 안 된 곳은 지도에서도 '미확인 후보'로 부른다
      const role = index === 0 ? (unconfirmed ? '미확인 후보' : '추천') : unconfirmed ? `미확인 대안 ${index}` : `대안 ${index}`;
      label.textContent = `${role}: ${place.name}`;
      label.className =
        index === 0
          ? 'whitespace-nowrap rounded-full bg-orange-500 px-3 py-1.5 text-sm font-bold text-white shadow-md'
          : 'whitespace-nowrap rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow';
      label.addEventListener('click', () => openRef.current(place));
      return new kakao.maps.CustomOverlay({ position, content: label, yAnchor: 1.2, zIndex: index === 0 ? 3 : 2, clickable: true, map });
    });
    if (placed.length > 1) map.setBounds(bounds, 80, 80, 80, 80);

    // 레이아웃이 자리 잡은 뒤 크기를 다시 잰다
    const observer = new ResizeObserver(() => map.relayout());
    observer.observe(container);
    return () => {
      observer.disconnect();
      overlays.forEach((overlay) => overlay.setMap(null));
      container.innerHTML = '';
    };
    // key가 같으면 같은 장소들이라 다시 그리지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!hasKakaoMaps() || placed.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-500">
        지도를 불러오지 못했어요. 왼쪽 지도 앱 버튼으로 위치를 확인해 주세요.
      </div>
    );
  }
  return <div ref={containerRef} className="h-full w-full overflow-hidden rounded-2xl bg-gray-100" aria-label="추천 장소 지도" />;
}
