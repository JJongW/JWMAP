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
      setLevel(level: number): void; // 지도 레벨(줌) 설정
      getLevel(): number; // 현재 지도 레벨 가져오기
    }
  
    interface MapOptions {
      center: LatLng; // 중심 좌표
      level: number; // 줌 레벨
    }
  
    // Size 클래스 정의
    class Size {
      constructor(width: number, height: number);
    }

    // Point 클래스 정의
    class Point {
      constructor(x: number, y: number);
    }

    // MarkerImage 클래스 정의
    class MarkerImage {
      constructor(src: string, size: Size, options?: { offset?: Point; alt?: string; shape?: string; coords?: string; spriteOrigin?: Point; spriteSize?: Size });
    }

    // Marker 클래스 정의
    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void; // 마커를 특정 지도에 설정하거나 제거
      setPosition(position: LatLng): void; // 마커 위치 설정
      setImage(image: MarkerImage | null): void; // 마커 이미지 설정
      setTitle(title: string): void; // 마커 제목 설정
      setZIndex(zIndex: number): void; // 마커 z-index 설정
      getPosition(): LatLng; // 마커 위치 가져오기
    }
  
    interface MarkerOptions {
      position: LatLng; // 마커 위치
      image?: MarkerImage; // 마커 이미지 (선택)
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

    // Services 네임스페이스 정의
    namespace services {
      enum Status {
        OK = 'OK',
        ZERO_RESULT = 'ZERO_RESULT',
        ERROR = 'ERROR',
      }

      // Geocoder 클래스 정의
      class Geocoder {
        addressSearch(
          address: string,
          callback: (result: Geocoder.Result[], status: Status) => void
        ): void;
      }

      namespace Geocoder {
        interface Result {
          address_name: string;
          y: string; // 위도
          x: string; // 경도
          address_type: string;
          road_address?: {
            address_name: string;
            region_1depth_name: string;
            region_2depth_name: string;
            region_3depth_name: string;
            road_name: string;
            underground_yn: string;
            main_building_no: string;
            sub_building_no: string;
            building_name: string;
            zone_no: string;
          };
        }
      }
    }
  }
  