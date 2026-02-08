import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Kakao Maps SDK 동적 로드
function loadKakaoMapsSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 이미 로드 + 초기화되어 있으면 즉시 resolve
    // LatLng가 생성자인지 확인하여 SDK가 완전히 초기화됐는지 판단
    if (typeof window !== 'undefined' && (window as any).kakao?.maps?.LatLng) {
      resolve();
      return;
    }

    const apiKey = import.meta.env.VITE_KAKAO_APP_API_KEY;
    if (!apiKey) {
      console.warn('VITE_KAKAO_APP_API_KEY 환경변수가 설정되지 않았습니다. 지도 기능이 작동하지 않을 수 있습니다.');
      // API 키가 없어도 앱은 실행되도록 resolve (지도 없이 동작)
      resolve();
      return;
    }

    // 이미 스크립트가 추가되어 있는지 확인
    const existingScript = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existingScript) {
      // 스크립트가 있으면 SDK 완전 초기화를 기다림 (LatLng 생성자 유무로 판단)
      const checkInterval = setInterval(() => {
        if (typeof window !== 'undefined' && (window as any).kakao?.maps?.LatLng) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (typeof window !== 'undefined' && (window as any).kakao?.maps?.LatLng) {
          resolve();
        } else {
          console.warn('Kakao Maps SDK 로드 시간 초과. 지도 기능이 작동하지 않을 수 있습니다.');
          resolve(); // 타임아웃되어도 앱은 실행되도록
        }
      }, 10000);
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    // autoload=false: async 로드 시 document.write 충돌 방지.
    // SDK 다운로드 후 kakao.maps.load() 콜백에서 수동 초기화.
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services,clusterer,drawing`;
    script.async = true;
    script.onload = () => {
      // autoload=false이므로 kakao.maps.load()를 직접 호출해야 함
      if (typeof window !== 'undefined' && (window as any).kakao?.maps?.load) {
        (window as any).kakao.maps.load(() => {
          resolve();
        });
      } else {
        console.warn('Kakao Maps SDK가 로드되었지만 초기화되지 않았습니다.');
        resolve();
      }
    };
    script.onerror = (error) => {
      console.error('Kakao Maps SDK 로드 실패:', error);
      // 에러가 발생해도 앱은 실행되도록 resolve (지도 없이 동작)
      resolve();
    };
    document.head.appendChild(script);
    
    // 타임아웃 설정 (10초)
    setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).kakao?.maps?.LatLng) {
        resolve();
      } else {
        console.warn('Kakao Maps SDK 로드 시간 초과. 지도 기능이 작동하지 않을 수 있습니다.');
        resolve(); // 타임아웃되어도 앱은 실행되도록
      }
    }, 10000);
  });
}

// SDK 로드 후 앱 렌더링
loadKakaoMapsSDK()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch((error) => {
    console.error('Kakao Maps SDK 로드 실패:', error);
    // SDK 로드 실패해도 앱은 렌더링 (지도 없이 동작)
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });