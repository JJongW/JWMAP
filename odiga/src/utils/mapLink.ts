export function naverMapLink(placeName: string): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(placeName)}`;
}

export function kakaoMapLink(placeName: string): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(placeName)}`;
}
