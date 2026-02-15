/**
 * 네이버 place URL에서 장소 상세 정보 추출
 *
 * m.place.naver.com/place/{id} 모바일 페이지 fetch → og, JSON-LD, 링크 내 좌표 파싱
 * 네이버는 place-by-ID 공개 API가 없어 HTML 파싱에 의존
 *
 * 지원 URL 형식:
 * - map.naver.com/p/search/.../place/2042329763
 * - map.naver.com/p/entry/place/2042329763
 * - m.place.naver.com/place/2042329763
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractRegionFromAddress } from '@/lib/mappings';

const NAVER_PLACE_REGEX = /(?:map\.naver\.com\/p\/(?:search|entry)\/[^/]*\/place\/|m\.place\.naver\.com\/place\/)(\d{4,})/i;

function extractNaverPlaceId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('naver')) return null;
    return parsed.pathname.match(/\/place\/(\d{4,})/)?.[1] ?? null;
  } catch {
    return url.match(NAVER_PLACE_REGEX)?.[1] ?? url.match(/\/place\/(\d{4,})/)?.[1] ?? null;
  }
}

function extractMetaContent(html: string, key: string): string | null {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<meta[^>]*(?:property|name)=["']${esc}["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*(?:property|name)=["']${esc}["']`,
    'i',
  );
  const m = html.match(pattern);
  return (m?.[1] ?? m?.[2])?.trim() ?? null;
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const match = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** nso_path 등 URL 파라미터에서 longitude, latitude 추출 */
function extractCoordsFromHtml(html: string): { lat?: number; lon?: number } {
  const latMatch = html.match(/latitude["']?\s*[=%\^]\s*([\d.-]+)/i) ?? html.match(/latitude%5E([\d.-]+)/i);
  const lonMatch = html.match(/longitude["']?\s*[=%\^]\s*([\d.-]+)/i) ?? html.match(/longitude%5E([\d.-]+)/i);
  const lat = latMatch ? parseFloat(latMatch[1]) : undefined;
  const lon = lonMatch ? parseFloat(lonMatch[1]) : undefined;
  if (lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)) {
    return { lat, lon };
  }
  return {};
}

function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.matchAll(/#[\p{L}\p{N}_-]+/gu);
  return Array.from(new Set(Array.from(matches).map((m) => m[0].slice(1))));
}

function extractDescriptionWithoutHashtags(text: string): string {
  if (!text) return '';
  return text
    .replace(/#[\p{L}\p{N}_-]+/gu, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url') ?? request.nextUrl.searchParams.get('placeId');
  if (!raw) {
    return NextResponse.json({ error: 'url 또는 placeId가 필요합니다' }, { status: 400 });
  }

  let placeId: string | null = null;
  if (/^\d{4,}$/.test(raw)) {
    placeId = raw;
  } else if (raw.startsWith('http')) {
    placeId = extractNaverPlaceId(raw);
  } else {
    placeId = extractNaverPlaceId(raw);
  }

  if (!placeId) {
    return NextResponse.json(
      { error: 'map.naver.com 또는 m.place.naver.com place URL이 필요합니다' },
      { status: 400 },
    );
  }

  const placeUrl = `https://m.place.naver.com/place/${placeId}`;
  let html = '';

  try {
    const res = await fetch(placeUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: '네이버 플레이스 페이지를 불러올 수 없습니다', status: res.status },
        { status: 502 },
      );
    }
    html = await res.text();
  } catch (err) {
    return NextResponse.json(
      { error: '페이지 fetch 실패', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }

  const ogTitle = extractMetaContent(html, 'og:title');
  const ogDescription = extractMetaContent(html, 'og:description');
  const ogImage = extractMetaContent(html, 'og:image');
  const jsonLd = extractJsonLd(html);
  const coordsFromHtml = extractCoordsFromHtml(html);

  let name = ogTitle ?? (jsonLd && typeof jsonLd.name === 'string' ? jsonLd.name : null);
  let address = (jsonLd?.address as { streetAddress?: string } | undefined)?.streetAddress ?? null;
  let lat = (jsonLd?.geo as { latitude?: number } | undefined)?.latitude ?? coordsFromHtml.lat;
  let lon = (jsonLd?.geo as { longitude?: number } | undefined)?.longitude ?? coordsFromHtml.lon;

  // HTML에서 주소 패턴 추출 (서울/경기 등으로 시작)
  if (!address && ogDescription) {
    const addrMatch = ogDescription.match(/((?:서울|경기|인천|부산|대구|대전|광주|울산|세종|제주)[^\n#]{5,100})/);
    if (addrMatch) address = addrMatch[1].trim();
  }
  if (!address && html) {
    const addrMatch = html.match(/((?:서울|경기|인천|부산)[^<"']{8,80})/);
    if (addrMatch) address = addrMatch[1].replace(/&amp;/g, '&').trim();
  }

  // 전화번호 추출
  const phoneMatch = html.match(/tel:([0-9-]+)/) ?? html.match(/(\d{2,3}-\d{3,4}-\d{4})/);
  const phone = phoneMatch?.[1] ?? null;

  const regionResult = address ? extractRegionFromAddress(address) : null;
  const hashtags = extractHashtags(ogDescription ?? '');
  const shortDesc = extractDescriptionWithoutHashtags(ogDescription ?? '');

  const memoLines: string[] = [];
  memoLines.push(`- 네이버 플레이스 URL: ${placeUrl}`);
  if (phone) memoLines.push(`- 전화번호: ${phone}`);
  if (hashtags.length > 0) memoLines.push(`- 해시태그: #${hashtags.join(' #')}`);

  return NextResponse.json({
    name: name ?? `장소 ${placeId}`,
    address: address ?? '',
    lat: lat ?? 0,
    lon: lon ?? 0,
    region: regionResult?.region ?? '',
    sub_region: regionResult?.sub_region ?? null,
    category_main: null,
    category_sub: null,
    kakao_place_id: null,
    naver_place_id: placeId,
    imageUrl: ogImage ?? '',
    tags: hashtags,
    short_desc: shortDesc || null,
    memo: memoLines.join('\n'),
  });
}
