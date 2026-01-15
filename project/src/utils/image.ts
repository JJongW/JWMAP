/**
 * HTTP URL을 HTTPS로 변환
 */
function ensureHttps(url: string): string {
  if (!url) return '';
  return url.replace(/^http:\/\//i, 'https://');
}

/**
 * Cloudinary 이미지 URL을 리사이즈된 버전으로 변환
 * @param url 원본 이미지 URL
 * @param width 최대 너비 (기본 480px)
 * @param quality 품질 (기본 auto)
 * @returns 변환된 URL 또는 원본 URL (Cloudinary가 아닌 경우)
 */
export function getOptimizedImageUrl(
  url: string,
  width: number = 480,
  quality: string = 'auto'
): string {
  if (!url) return '';

  // HTTP -> HTTPS 변환
  const secureUrl = ensureHttps(url);

  // Cloudinary URL 패턴 체크
  // 예: https://res.cloudinary.com/xxxxx/image/upload/v1234567890/image.jpg
  const cloudinaryRegex = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)(\/v\d+)?(\/.*)?$/;
  const match = secureUrl.match(cloudinaryRegex);

  if (match) {
    const [, base, version = '', path = ''] = match;
    // 변환 파라미터 추가: 너비 제한, 자동 품질, 자동 포맷(WebP 등)
    const transformation = `/w_${width},c_limit,q_${quality},f_auto`;
    return `${base}${transformation}${version}${path}`;
  }

  // Cloudinary가 아닌 경우 HTTPS 변환된 URL 반환
  return secureUrl;
}

/**
 * 썸네일용 이미지 URL (작은 사이즈)
 */
export function getThumbnailUrl(url: string): string {
  return getOptimizedImageUrl(url, 320, 'auto');
}

/**
 * 카드용 이미지 URL (중간 사이즈)
 */
export function getCardImageUrl(url: string): string {
  return getOptimizedImageUrl(url, 480, 'auto');
}

/**
 * 상세 페이지용 이미지 URL (큰 사이즈)
 */
export function getDetailImageUrl(url: string): string {
  return getOptimizedImageUrl(url, 800, 'auto:good');
}
