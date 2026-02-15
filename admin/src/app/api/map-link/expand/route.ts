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

    return NextResponse.json({
      inputUrl: target.toString(),
      finalUrl: response.url,
      status: response.status,
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
