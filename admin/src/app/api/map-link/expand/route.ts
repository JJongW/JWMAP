import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'kko.to',
  'naver.me',
  'map.kakao.com',
  'place.map.kakao.com',
  'm.map.kakao.com',
  'map.naver.com',
  'm.place.naver.com',
]);

function isAllowedTarget(url: URL): boolean {
  return ALLOWED_HOSTS.has(url.hostname);
}

function extractMetaContent(html: string, key: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  );
  return html.match(pattern)?.[1]?.trim() ?? null;
}

function extractTitle(html: string): string | null {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  if (!title) return null;
  return title
    .replace(/\s*[-|]\s*카카오맵.*$/i, '')
    .replace(/\s*[-|]\s*NAVER Map.*$/i, '')
    .trim();
}

function extractKakaoPlaceId(text: string): string | null {
  return (
    text.match(/place\.map\.kakao\.com\/(\d{4,})/i)?.[1] ??
    text.match(/itemId=(\d{4,})/i)?.[1] ??
    text.match(/["']id["']\s*[:=]\s*["']?(\d{4,})["']?/i)?.[1] ??
    null
  );
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(target.protocol) || !isAllowedTarget(target)) {
    return NextResponse.json({ error: 'unsupported url host' }, { status: 400 });
  }

  try {
    const response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': 'JWMAP-Admin-LinkResolver/1.0',
      },
    });

    const contentType = response.headers.get('content-type') ?? '';
    let title: string | null = null;
    let description: string | null = null;
    let kakaoPlaceId: string | null = null;

    if (contentType.includes('text/html')) {
      const html = await response.text();
      const ogTitle = extractMetaContent(html, 'og:title');
      const ogDescription = extractMetaContent(html, 'og:description');
      const ogUrl = extractMetaContent(html, 'og:url');

      title = ogTitle || extractTitle(html);
      description = ogDescription;

      const placeIdFromText = extractKakaoPlaceId(html);
      const placeIdFromUrl = extractKakaoPlaceId(response.url);
      const placeIdFromOgUrl = ogUrl ? extractKakaoPlaceId(ogUrl) : null;
      kakaoPlaceId = placeIdFromText || placeIdFromUrl || placeIdFromOgUrl;
    } else {
      kakaoPlaceId = extractKakaoPlaceId(response.url);
    }

    return NextResponse.json({
      inputUrl: target.toString(),
      finalUrl: response.url,
      status: response.status,
      title,
      description,
      kakaoPlaceId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'failed to resolve link',
        message: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 502 },
    );
  }
}
