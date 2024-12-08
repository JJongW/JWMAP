declare namespace kakao.maps {
    // LatLng 클래스 정의
    class LatLng {
      constructor(lat: number, lng: number); // lat: 위도, lng: 경도
    }
  
    // 지도(Map) 클래스 정의
    class Map {
      constructor(container: HTMLElement, options: MapOptions);
      setCenter(latlng: LatLng): void; // 지도 중심 설정
      panTo(latlng: LatLng): void; // 지도 중심을 부드럽게 이동
    }
  
    interface MapOptions {
      center: LatLng; // 중심 좌표
      level: number; // 줌 레벨
    }
  
    // Marker 클래스 정의
    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void; // 마커를 특정 지도에 설정하거나 제거
    }
  
    interface MarkerOptions {
      position: LatLng; // 마커 위치
      title?: string; // 마커 제목 (선택)
    }
  
    // InfoWindow 클래스 정의
    class InfoWindow {
      constructor(options: InfoWindowOptions);
      open(map: Map, marker: Marker): void; // 특정 지도 및 마커와 연결
      close(): void; // 정보창 닫기
    }
  
    interface InfoWindowOptions {
      content: string | HTMLElement; // 정보창 내용
      position?: LatLng; // 정보창 위치
      removable?: boolean; // 닫기 버튼 표시 여부
    }
  
    // Event 네임스페이스 정의
    namespace event {
      function addListener<T extends kakao.maps.Map | kakao.maps.Marker | kakao.maps.InfoWindow>(
        target: T,
        type: string,
        callback: (event: { latLng?: LatLng; [key: string]: unknown }) => void
      ): void;
    }
  }
  