export interface ParsedMapClipboard {
  name?: string;
  address?: string;
  lat?: number;
  lon?: number;
  kakao_place_id?: string;
  naver_place_id?: string;
  categoryHint?: string;
  categoryRaw?: string;
  rating?: number;
  reviewCount?: number;
  hashtags: string[];
  websiteUrl?: string;
  nearbyTransit?: string;
  reviewSnippets: string[];
  sourceUrls: string[];
}

function toNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function pickFirstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return undefined;
}

const LINE_NOISE_KEYWORDS = [
  '본문 바로가기',
  '메뉴 바로가기',
  'kakaomap',
  '검색창',
  '프로필',
  '로드뷰',
  '공유',
  '즐겨찾기',
  '출발',
  '도착',
  '홈',
  '사진',
  '후기',
  '블로그',
  '랭킹',
  '북마크',
  'URL',
  '주소',
  '복사',
  '펼치기',
  '인증 매장',
  '매장관리',
  '정보 수정',
  '이 지역 검색 랭킹',
  '업데이트',
  '접기',
  '장소 더보기',
  '블로그 리뷰',
  '프린트하기',
  '약관 및 정책',
  '공지사항',
  '개인정보처리방침',
  '고객센터',
];

const LEFT_CATEGORY_SUFFIXES = [
  '문구',
  '카페',
  '식당',
  '박물관',
  '미술관',
  '전시관',
  '소품샵',
  '편집샵',
  '서점',
  '갤러리',
];

function isLikelyNoiseLine(line: string): boolean {
  const compact = line.replace(/\s+/g, '').toLowerCase();
  if (!compact) return true;
  if (compact.startsWith('http://') || compact.startsWith('https://')) return true;
  if (/^\d+(\.\d+)?$/.test(compact)) return true;
  return LINE_NOISE_KEYWORDS.some((keyword) => compact.includes(keyword.replace(/\s+/g, '').toLowerCase()));
}

function parseNameAndCategoryFromLine(line: string): { name?: string; categoryRaw?: string } {
  const cleaned = line
    .replace(/\s*\|\s*카카오맵.*$/i, '')
    .replace(/\s*[-|]\s*NAVER\s*Map.*$/i, '')
    .trim();

  if (!cleaned) return {};

  if (cleaned.includes(',')) {
    const commaIndex = cleaned.indexOf(',');
    const left = cleaned.slice(0, commaIndex).trim();
    const right = cleaned.slice(commaIndex + 1).trim();

    if (left && right) {
      for (const suffix of LEFT_CATEGORY_SUFFIXES) {
        if (left.endsWith(suffix) && left.length > suffix.length) {
          return {
            name: left.slice(0, -suffix.length).trim(),
            categoryRaw: `${suffix},${right}`,
          };
        }
      }
      return { name: left, categoryRaw: `${left.includes(' ') ? '' : ''}${right ? `${left},${right}` : left}` };
    }
  }

  return { name: cleaned };
}

/** 리뷰/설명 형태 문장 추출 (카카오맵 복붙 콘텐츠용) */
function extractReviewSnippets(text: string): string[] {
  const cleaned = (line: string) =>
    line.replace(/\s*\.{2,}\s*더보기\s*$/, '').replace(/\s+$/, '').trim();

  const lines = text
    .split(/[\n\r]+/)
    .map((l) => cleaned(l.trim()))
    .filter((line) => line.length >= 12 && line.length <= 150)
    .filter((line) => /[가-힣]/.test(line))
    .filter((line) => !line.includes('http') && !line.startsWith('http'))
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !/^\d{2}\.\d{2}\.?\d{0,2}\s*$/.test(line))
    .filter((line) => !LINE_NOISE_KEYWORDS.some((k) => line.includes(k)))
    .filter((line) => !/^[0-9점\.\s]+$/.test(line))
    .slice(0, 5);

  return Array.from(new Set(lines));
}

function extractCoordsFromUrl(url: string): { lat?: number; lon?: number } {
  try {
    const parsed = new URL(url);
    const lat = toNumber(
      parsed.searchParams.get('lat') ??
        parsed.searchParams.get('y') ??
        parsed.searchParams.get('latitude') ??
        undefined,
    );
    const lon = toNumber(
      parsed.searchParams.get('lng') ??
        parsed.searchParams.get('lon') ??
        parsed.searchParams.get('x') ??
        parsed.searchParams.get('longitude') ??
        undefined,
    );
    return { lat, lon };
  } catch {
    return {};
  }
}

export function parseMapClipboard(raw: string): ParsedMapClipboard {
  const text = raw.trim();
  if (!text) {
    return { sourceUrls: [], hashtags: [], reviewSnippets: [] };
  }

  const sourceUrls = Array.from(text.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const explicitName =
    pickFirstMatch(text, [
      /(?:장소명|상호|이름)\s*[:：]\s*([^\n]+)/i,
      /(?:name)\s*[:：]\s*([^\n]+)/i,
    ]);

  const firstMeaningfulLine = lines.find((line) => !isLikelyNoiseLine(line) && line.length <= 60);
  const nameAndCategory = parseNameAndCategoryFromLine(firstMeaningfulLine ?? '');
  const name = explicitName ?? nameAndCategory.name;

  const address = pickFirstMatch(text, [
    /(?:주소|road address|address)\s*[:：]\s*([^\n]+)/i,
    /((?:서울|경기|인천|부산|대구|대전|광주|울산|세종|제주)[^\n]{8,})/,
  ]);

  let lat = pickFirstMatch(text, [/(?:위도|lat|latitude)\s*[:：]?\s*(-?\d{1,2}\.\d+)/i]);
  let lon = pickFirstMatch(text, [/(?:경도|lng|lon|longitude|x)\s*[:：]?\s*(-?\d{1,3}\.\d+)/i]);

  if (!lat || !lon) {
    const pair = text.match(/(-?\d{1,2}\.\d+)\s*[,/]\s*(-?\d{1,3}\.\d+)/);
    if (pair) {
      lat = lat ?? pair[1];
      lon = lon ?? pair[2];
    }
  }

  let latNumber = toNumber(lat);
  let lonNumber = toNumber(lon);

  for (const url of sourceUrls) {
    const fromUrl = extractCoordsFromUrl(url);
    latNumber = latNumber ?? fromUrl.lat;
    lonNumber = lonNumber ?? fromUrl.lon;
  }

  const kakao_place_id =
    pickFirstMatch(text, [
      /(?:kakao[_\s-]?place[_\s-]?id)\s*[:：]?\s*(\d{4,})/i,
      /place\.map\.kakao\.com\/(\d{4,})/i,
      /map\.kakao\.com\/\?itemId=(\d{4,})/i,
    ]) ?? undefined;

  const naver_place_id =
    pickFirstMatch(text, [
      /(?:naver[_\s-]?place[_\s-]?id)\s*[:：]?\s*(\d{4,})/i,
      /map\.naver\.com\/p\/entry\/place\/(\d{4,})/i,
      /m\.place\.naver\.com\/place\/(\d{4,})/i,
    ]) ?? undefined;

  const categoryHint = pickFirstMatch(text, [
    /(?:카테고리|분류|업종)\s*[:：]\s*([^\n]+)/i,
    /(?:category)\s*[:：]\s*([^\n]+)/i,
  ]);

  const categoryRaw =
    nameAndCategory.categoryRaw ??
    pickFirstMatch(text, [
      /([가-힣A-Za-z]+,\s*[가-힣A-Za-z]+)/,
      /(?:업종)\s*[:：]?\s*([^\n]+)/i,
    ]);

  const ratingRaw = pickFirstMatch(text, [
    /(?:평점|별점)\s*[:：]?\s*(\d\.\d)/i,
    /(\d\.\d)\s*(?:후기|리뷰)/i,
  ]);
  const rating = toNumber(ratingRaw);

  const reviewCountRaw = pickFirstMatch(text, [
    /(?:후기|리뷰)\s*[:：]?\s*(\d{1,4})/i,
    /(\d{1,4})\s*(?:후기|리뷰)/i,
  ]);
  const reviewCount = reviewCountRaw ? Number(reviewCountRaw) : undefined;

  const hashtags = Array.from(new Set(Array.from(text.matchAll(/#[\p{L}\p{N}_-]+/gu)).map((m) => m[0])));

  const websiteUrl =
    pickFirstMatch(text, [/URL\s*[:：]?\s*(https?:\/\/[^\s\n]+)/i]) ??
    sourceUrls.find(
      (url) => !url.includes('kko.to') && !url.includes('kakao.com') && !url.includes('naver.com'),
    );

  const nearbyTransit = pickFirstMatch(text, [/([가-힣A-Za-z0-9\s]+역\s*\d+번 출구[^\n]*)/]);
  const reviewSnippets = extractReviewSnippets(text);

  return {
    name,
    address,
    lat: latNumber,
    lon: lonNumber,
    kakao_place_id,
    naver_place_id,
    categoryHint,
    categoryRaw,
    rating,
    reviewCount,
    hashtags,
    websiteUrl,
    nearbyTransit,
    reviewSnippets,
    sourceUrls,
  };
}
