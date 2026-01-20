/**
 * 위치 관련 유틸리티 함수
 * 
 * 두 좌표 간의 거리를 계산하는 함수들을 제공합니다.
 */

/**
 * 하버사인 공식을 사용하여 두 지점 간의 거리를 계산합니다 (단위: km)
 * 
 * @param lat1 첫 번째 지점의 위도
 * @param lon1 첫 번째 지점의 경도
 * @param lat2 두 번째 지점의 위도
 * @param lon2 두 번째 지점의 경도
 * @returns 거리 (킬로미터)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 지구의 반지름 (km)
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * 각도를 라디안으로 변환합니다
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * 거리를 포맷팅된 문자열로 변환합니다
 * 
 * @param distance 거리 (킬로미터)
 * @returns 포맷팅된 문자열 (예: "0.5km", "1.2km", "500m")
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
}
