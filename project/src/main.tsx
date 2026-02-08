import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Kakao Maps SDK 동적 로드
function loadKakaoMapsSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 이미 로드되어 있으면 즉시 resolve
    if (typeof window !== 'undefined' && (window as any).kakao?.maps) {
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
      // 스크립트가 있으면 로드 완료를 기다림
      const checkInterval = setInterval(() => {
        if (typeof window !== 'undefined' && (window as any).kakao?.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (typeof window !== 'undefined' && (window as any).kakao?.maps) {
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
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,clusterer,drawing`;
    script.async = true;
    script.onload = () => {
      // 로드 후 약간의 지연을 두고 확인
      setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).kakao?.maps) {
          resolve();
        } else {
          console.warn('Kakao Maps SDK가 로드되었지만 초기화되지 않았습니다.');
          resolve(); // 실패해도 앱은 실행되도록
        }
      }, 100);
    };
    script.onerror = (error) => {
      console.error('Kakao Maps SDK 로드 실패:', error);
      // 에러가 발생해도 앱은 실행되도록 resolve (지도 없이 동작)
      resolve();
    };
    document.head.appendChild(script);
    
    // 타임아웃 설정 (10초)
    setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).kakao?.maps) {
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