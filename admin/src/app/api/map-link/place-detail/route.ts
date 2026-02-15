/**
 * 카카오 place URL에서 장소 상세 정보 추출
 *
 * 1. place.map.kakao.com URL fetch → og:title, og:description, og:image, place ID
 * 2. Kakao Local API 키워드 검색으로 동일 place ID 문서 조회
 * 3. 주소→지역 매핑, 카테고리 매핑, 해시태그 추출
 *
 * 환경변수: KAKAO_REST_API_KEY (또는 NEXT_PUBLIC_KAKAO_REST_API_KEY)
 */

import { NextRequest, NextResponse } from 'next/server';
import { mapKakaoCategoryByDomain, extractRegionFromAddress } from '@/lib/mappings';

const PLACE_URL_REGEX = /place\.map\.kakao\.com\/(\d{4,})/i;

function extractKakaoPlaceId(text: string): string | null {
  return text.match(PLACE_URL_REGEX)?.[1] ?? null;
}

function extractMetaContent(html: string, key: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  );
  return html.match(pattern)?.[1]?.trim() ?? null;
}

function extractTitle(html: string): string | null {
  const fromMeta = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  const raw = fromMeta ?? html.match(/^([^<\n]+)\s*[-|]\s*카카오맵/im)?.[1]?.trim();
  if (!raw) return null;
  return raw
    .replace(/\s*[-|]\s*카카오맵.*$/i, '')
    .replace(/\s*[-|]\s*NAVER Map.*$/i, '')
    .trim();
}

/** og:description에서 #해시태그 추출 (태그명만, # 제외) */
function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.matchAll(/#[\p{L}\p{N}_-]+/gu);
  return Array.from(new Set(Array.from(matches).map((m) => m[0].slice(1))));
}

/** og:description에서 해시태그·URL 제외한 설명 텍스트 (리뷰 스니펫으로 활용) */
function extractDescriptionWithoutHashtags(text: string): string {
  if (!text) return '';
  return text
    .replace(/#[\p{L}\p{N}_-]+/gu, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

interface KakaoPlaceDoc {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string;
  y: string;
  category_name: string;
  category_group_name?: string;
  phone?: string;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url') ?? request.nextUrl.searchParams.get('placeId');
  if (!raw) {
    return NextResponse.json({ error: 'url 또는 placeId가 필요합니다' }, { status: 400 });
  }

  let placeId: string | null = null;
  let placeUrl: string | null = null;

  if (/^\d{4,}$/.test(raw)) {
    placeId = raw;
    placeUrl = `https://place.map.kakao.com/${raw}`;
  } else {
    placeId = extractKakaoPlaceId(raw);
    placeUrl = raw.startsWith('http') ? raw : null;
  }

  if (!placeId) {
    return NextResponse.json({ error: 'place.map.kakao.com URL 또는 place ID가 필요합니다' }, { status: 400 });
  }

  const apiKey =
    process.env.KAKAO_REST_API_KEY ?? process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'KAKAO_REST_API_KEY가 설정되지 않았습니다' },
      { status: 500 },
    );
  }

  let ogTitle: string | null = null;
  let ogDescription: string | null = null;
  let ogImage: string | null = null;

  if (placeUrl) {
    try {
      const res = await fetch(placeUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'user-agent': 'JWMAP-Admin-PlaceDetail/1.0 (Mozilla/5.0 compatible)' },
      });
      if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) {
        const html = await res.text();
        ogTitle = extractMetaContent(html, 'og:title') ?? extractTitle(html);
        ogDescription = extractMetaContent(html, 'og:description');
        ogImage = extractMetaContent(html, 'og:image');
      }
    } catch {
      // 페이지 fetch 실패 시에도 API 검색 시도
    }
  }

  const placeName = ogTitle ?? placeId;
  let doc: KakaoPlaceDoc | null = null;

  try {
    const searchRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(placeName)}&size=15`,
      { headers: { Authorization: `KakaoAK ${apiKey}` } },
    );
    const data = (await searchRes.json()) as { documents?: KakaoPlaceDoc[] };
    const docs = data.documents ?? [];
    doc = docs.find((d) => d.id === placeId) ?? docs[0] ?? null;
  } catch (err) {
    return NextResponse.json(
      { error: 'Kakao API 검색 실패', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }

  if (!doc) {
    return NextResponse.json(
      {
        error: '장소를 찾을 수 없습니다',
        placeId,
        placeName,
        hint: '장소명이 정확한지 확인하거나, PlaceSearch로 직접 검색해주세요.',
      },
      { status: 404 },
    );
  }

  const address = doc.road_address_name || doc.address_name;
  const lat = parseFloat(doc.y);
  const lon = parseFloat(doc.x);

  const regionResult = extractRegionFromAddress(address);
  const domain = (request.nextUrl.searchParams.get('domain') ?? 'attractions') as 'locations' | 'attractions';
  const categoryMapped = mapKakaoCategoryByDomain(doc.category_name ?? doc.category_group_name ?? '', domain);

  const hashtags = extractHashtags(ogDescription ?? '');
  const shortDesc = extractDescriptionWithoutHashtags(ogDescription ?? '');

  const memoLines: string[] = [];
  if (placeUrl) memoLines.push(`- 카카오맵 URL: ${placeUrl}`);
  if (doc.phone) memoLines.push(`- 전화번호: ${doc.phone}`);
  if (hashtags.length > 0) memoLines.push(`- 해시태그: #${hashtags.join(' #')}`);

  return NextResponse.json({
    name: doc.place_name,
    address,
    lat,
    lon,
    region: regionResult?.region ?? '',
    sub_region: regionResult?.sub_region ?? null,
    category_main: categoryMapped.main ?? null,
    category_sub: categoryMapped.sub ?? null,
    kakao_place_id: placeId,
    imageUrl: ogImage ?? '',
    tags: hashtags,
    short_desc: shortDesc || null,
    memo: memoLines.length > 0 ? memoLines.join('\n') : null,
  });
}
