/**
 * mapOpen.ts
 *
 * 네이버 지도·카카오맵 열기.
 * 장소 ID가 있으면 그 장소 페이지로, 없으면 이름으로 검색한다 (버튼 문구도 mapLinkLabel로 맞춘다).
 * PC: 새 탭으로 연다 (보던 추천 화면은 그대로 남는다).
 * 모바일: 앱 딥링크 시도 → 700ms 안에 앱으로 넘어가지 않았을 때만 웹 지도로.
 * 앱으로 넘어간 뒤 돌아왔을 때 늦게 실행된 fallback이 보던 화면을 웹 지도로 바꾸지 않게 막는다.
 */

const MOBILE_MAX_WIDTH = 768;

interface MapPlace {
  name: string;
  kakao_place_id?: string | null;
  naver_place_id?: string | null;
}

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

/** appLink가 없으면 모바일에서도 웹 페이지로 (앱 딥링크 형식이 확인되지 않은 경우) */
function open(appLink: string | null, webLink: string) {
  if (window.innerWidth >= MOBILE_MAX_WIDTH) {
    window.open(webLink, '_blank', 'noopener');
    return;
  }
  if (!appLink) {
    window.location.href = webLink;
    return;
  }
  openWithAppFallback(appLink, webLink);
}

/** 장소 ID로 그 장소를 바로 여는지(place), 이름으로 검색하는지(search) */
export function mapLinkKind(place: MapPlace, provider: 'naver' | 'kakao'): 'place' | 'search' {
  return (provider === 'kakao' ? place.kakao_place_id : place.naver_place_id) ? 'place' : 'search';
}

/** 버튼 문구: 장소로 바로 가면 '…에서 보기', 이름 검색이면 '…에서 검색' (정확한 지점처럼 말하지 않는다) */
export function mapLinkLabel(place: MapPlace, provider: 'naver' | 'kakao'): string {
  const app = provider === 'kakao' ? '카카오맵' : '네이버 지도';
  return mapLinkKind(place, provider) === 'place' ? `${app}에서 보기` : `${app}에서 검색`;
}

export function openNaverMap(place: MapPlace) {
  if (place.naver_place_id) {
    const id = encodeURIComponent(place.naver_place_id);
    open(null, `https://map.naver.com/p/entry/place/${id}`);
    return;
  }
  const appName = encodeURIComponent(window.location.origin);
  const query = encodeURIComponent(place.name);
  open(`nmap://search?query=${query}&appname=${appName}`, `https://map.naver.com/v5/search/${query}`);
}

export function openKakaoMap(place: MapPlace) {
  if (place.kakao_place_id) {
    const id = encodeURIComponent(place.kakao_place_id);
    open(`kakaomap://place?id=${id}`, `https://place.map.kakao.com/${id}`);
    return;
  }
  const query = encodeURIComponent(place.name);
  open(`kakaomap://search?q=${query}`, `https://map.kakao.com/link/search/${query}`);
}
