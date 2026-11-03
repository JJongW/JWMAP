/**
 * mapOpen.ts
 *
 * 네이버 지도·카카오맵 열기.
 * PC: 새 탭으로 연다 (보던 추천 화면은 그대로 남는다).
 * 모바일: 앱 딥링크 시도 → 700ms 안에 앱으로 넘어가지 않았을 때만 웹 지도로.
 * 앱으로 넘어간 뒤 돌아왔을 때 늦게 실행된 fallback이 보던 화면을 웹 지도로 바꾸지 않게 막는다.
 */

const MOBILE_MAX_WIDTH = 768;

function openWithAppFallback(appLink: string, webLink: string) {
  let leftPage = false;
  const markLeft = () => {
    if (document.visibilityState === 'hidden') leftPage = true;
  };
  const markUnload = () => {
    leftPage = true;
  };
  document.addEventListener('visibilitychange', markLeft);
  window.addEventListener('pagehide', markUnload);

  window.location.href = appLink;
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', markLeft);
    window.removeEventListener('pagehide', markUnload);
    if (!leftPage && document.visibilityState === 'visible') {
      window.location.href = webLink;
    }
  }, 700);
}

export function openNaverMap(name: string) {
  const query = encodeURIComponent(name);
  const webLink = `https://map.naver.com/v5/search/${query}`;
  if (window.innerWidth >= MOBILE_MAX_WIDTH) {
    window.open(webLink, '_blank', 'noopener');
    return;
  }
  const appName = encodeURIComponent(window.location.origin);
  openWithAppFallback(`nmap://search?query=${query}&appname=${appName}`, webLink);
}

export function openKakaoMap(name: string) {
  const query = encodeURIComponent(name);
  const webLink = `https://map.kakao.com/link/search/${query}`;
  if (window.innerWidth >= MOBILE_MAX_WIDTH) {
    window.open(webLink, '_blank', 'noopener');
    return;
  }
  openWithAppFallback(`kakaomap://search?q=${query}`, webLink);
}
