export interface ParsedMapClipboard {
  name?: string;
  address?: string;
  lat?: number;
  lon?: number;
  kakao_place_id?: string;
  naver_place_id?: string;
  categoryHint?: string;
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
    return { sourceUrls: [] };
  }

  const sourceUrls = Array.from(text.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]);

  const name =
    pickFirstMatch(text, [
      /(?:장소명|상호|이름)\s*[:：]\s*([^\n]+)/i,
      /(?:name)\s*[:：]\s*([^\n]+)/i,
    ]) ??
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('http') && line.length <= 40);

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

  return {
    name,
    address,
    lat: latNumber,
    lon: lonNumber,
    kakao_place_id,
    naver_place_id,
    categoryHint,
    sourceUrls,
  };
}
