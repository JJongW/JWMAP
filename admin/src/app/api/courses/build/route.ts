import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/service';
import { extractRegionFromAddress, mapKakaoCategoryByDomain } from '@/lib/mappings';
import {
  cleanText,
  clampInt,
  uniqueTags,
  inferTagType,
  isLikelyChain,
  enforceCurationRules,
  pickDomain,
  walkingDistanceMeters,
  buildCourseHash,
  inferCategoryFromText,
  parseJsonChunk,
} from './helpers';

type DomainTable = 'locations' | 'attractions';
type TagDomain = 'food' | 'space';

// ── 블로그 리뷰 수집 ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchNaverBlogText(url: string): Promise<string> {
  try {
    const logNoMatch = url.match(/logNo=(\d+)/);
    const blogIdMatch = url.match(/blog\.naver\.com\/([^/?&#]+)/);
    if (!logNoMatch || !blogIdMatch) return '';

    const postViewUrl = `https://blog.naver.com/PostView.naver?blogId=${blogIdMatch[1]}&logNo=${logNoMatch[1]}&redirect=Dlog&widgetTypeCall=true`;
    const res = await fetch(postViewUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://blog.naver.com',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    return stripHtml(await res.text()).slice(0, 1500);
  } catch {
    return '';
  }
}

async function collectBlogReviews(placeName: string): Promise<string> {
  try {
    const query = encodeURIComponent(placeName);
    const res = await fetch(
      `https://search.naver.com/search.naver?where=blog&query=${query}&display=5`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return '';

    const html = await res.text();
    const urlPattern = /href="(https?:\/\/blog\.naver\.com\/[^"?]+)"/g;
    const blogUrls: string[] = [];
    let match;
    while ((match = urlPattern.exec(html)) !== null) {
      const url = match[1];
      if (!blogUrls.includes(url) && /\/\d+/.test(url)) {
        blogUrls.push(url);
        if (blogUrls.length >= 3) break;
      }
    }

    const texts: string[] = [];
    for (const url of blogUrls.slice(0, 2)) {
      const text = await fetchNaverBlogText(url);
      if (text.length > 100) texts.push(text);
    }
    return texts.join('\n---\n').slice(0, 3000);
  } catch {
    return '';
  }
}

interface InputPlace {
  name: string;
  note: string;
}

interface AiEnrichment {
  short_desc: string | null;
  memo: string | null;
  tags: string[];
  category_main: string | null;
  category_sub: string | null;
  price_level: number | null;
  curation_level: number | null;
  is_chain: boolean;
  waiting_hotspot: boolean;
}

interface PlaceLike {
  id: string;
  name: string;
  region: string;
  sub_region: string | null;
  category_main: string | null;
  category_sub: string | null;
  lon: number;
  lat: number;
  address: string;
  memo: string;
  short_desc: string | null;
  rating: number;
  price_level: number | null;
  tags: string[];
  imageUrl: string;
  naver_place_id: string | null;
  kakao_place_id: string | null;
}

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
};

const SITUATION_TAGS = ['데이트', '카공', '혼밥', '혼술', '가족모임', '친구모임', '산책', '드라이브'];
const MOOD_KEYWORDS = ['감성', '조용', '아늑', '빈티지', '모던', '힙', '고즈넉', '뷰맛집', '로컬', '활기'];

function withSupabaseHint(error: SupabaseErrorLike): string {
  const message = String(error.message || '알 수 없는 DB 오류');
  const isAuth = /Invalid API key|JWT|ApiKey|api key|Unauthorized/i.test(message);
  if (isAuth) {
    return `${message} (서비스키 확인 필요: SUPABASE_SERVICE_KEY)`;
  }

  return message;
}

function buildDbError(operation: 'insert' | 'update', domain: DomainTable, name: string, error: SupabaseErrorLike): string {
  const base = withSupabaseHint(error);
  const code = error.code ? ` (code: ${error.code})` : '';
  return `[${domain}] ${operation} failed for "${name}": ${base}${code}`;
}

function toTagDomain(domain: DomainTable): TagDomain {
  return domain === 'attractions' ? 'space' : 'food';
}

async function enrichWithAi(place: InputPlace): Promise<AiEnrichment> {
  const fallbackTags = uniqueTags(
    [
      ...SITUATION_TAGS.filter((t) => place.note.includes(t)),
      ...MOOD_KEYWORDS.filter((t) => place.note.includes(t)),
    ],
  );

  const fallback: AiEnrichment = {
    short_desc: place.note.slice(0, 90) || null,
    memo: null,
    tags: fallbackTags,
    category_main: null,
    category_sub: null,
    price_level: null,
    curation_level: 3,
    is_chain: isLikelyChain(place.name, place.note),
    waiting_hotspot: /웨이팅|줄\s?김|오픈런|대기/.test(place.note),
  };

  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) return fallback;

  const blogReviews = await collectBlogReviews(place.name);
  const blogSection = blogReviews
    ? `\n[블로그 리뷰 참고 (요약에 활용할 것)]\n${blogReviews}\n`
    : '';

  const prompt = [
    '너는 장소 큐레이션 데이터 정규화기다.',
    '장소명, 한줄느낌, 블로그 리뷰를 종합해서 JSON만 출력해.',
    '스키마:',
    '{',
    '  "short_desc": string|null,   // 1문장, 50자 이내, 장소의 핵심 매력',
    '  "memo": string|null,         // 3~5줄. 운영시간⏰, 주차🚗, 특징⭐, 방문팁💡 포함. 이모지 항목별 앞에 붙임. 줄바꿈 \\n 사용',
    '  "tags": string[],            // 3~7개. 분위기/상황/특징 태그 (예: 카공, 데이트, 감성카페, 조용한, 뷰맛집, 주차가능)',
    '  "category_main": string|null,',
    '  "category_sub": string|null,',
    '  "price_level": number|null,  // 1~4',
    '  "curation_level": number|null, // 1~5',
    '  "is_chain": boolean,',
    '  "waiting_hotspot": boolean',
    '}',
    '규칙:',
    '- memo는 블로그 리뷰 기반으로 실제 정보 위주로 작성. 리뷰 없으면 장소명/느낌에서 추론.',
    '- memo에 "방문 가이드" 같은 헤더 문구 절대 포함 금지.',
    '- tags는 반드시 3개 이상 포함. 비워두지 말 것.',
    '- chain 브랜드면 is_chain=true',
    blogSection,
    `장소명: ${place.name}`,
    `한줄느낌: ${place.note}`,
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
        }),
      },
    );

    if (!res.ok) return fallback;
    const body = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = parseJsonChunk(text);
    if (!parsed) return fallback;

    return {
      short_desc: cleanText(parsed.short_desc) || fallback.short_desc,
      memo: cleanText(parsed.memo) || fallback.memo,
      tags: uniqueTags(Array.isArray(parsed.tags) ? parsed.tags.map((t) => cleanText(t)) : fallback.tags),
      category_main: cleanText(parsed.category_main) || null,
      category_sub: cleanText(parsed.category_sub) || null,
      price_level: clampInt(parsed.price_level, 1, 4),
      curation_level: clampInt(parsed.curation_level, 1, 5) ?? fallback.curation_level,
      is_chain: Boolean(parsed.is_chain ?? fallback.is_chain),
      waiting_hotspot: Boolean(parsed.waiting_hotspot ?? fallback.waiting_hotspot),
    };
  } catch {
    return fallback;
  }
}

type KakaoDoc = {
  id: string;
  address_name: string;
  road_address_name?: string;
  x: string;
  y: string;
  category_name: string;
};

async function kakaoKeywordSearch(query: string, apiKey: string): Promise<KakaoDoc | null> {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=3`,
    { headers: { Authorization: `KakaoAK ${apiKey}` } },
  );
  if (!res.ok) return null;
  const data = await res.json() as { documents?: KakaoDoc[] };
  return data.documents?.[0] ?? null;
}

async function searchKakaoPlace(name: string, noteHint = ''): Promise<{
  address: string;
  lat: number;
  lon: number;
  kakao_place_id: string | null;
  category_main: string | null;
  category_sub: string | null;
}> {
  const empty = { address: '', lat: 0, lon: 0, kakao_place_id: null, category_main: null, category_sub: null };
  const apiKey = (process.env.KAKAO_REST_API_KEY || process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY)?.trim();
  if (!apiKey) return empty;

  try {
    // 1차: 이름만으로 검색
    let first = await kakaoKeywordSearch(name, apiKey);

    // 2차: 서울 + 이름 (지역 힌트 추가)
    if (!first) first = await kakaoKeywordSearch(`서울 ${name}`, apiKey);

    // 3차: 노트에 카테고리 힌트 추출해서 재시도
    if (!first && noteHint) {
      const hint = /브런치|양식|카페|식당|레스토랑|바/.exec(noteHint)?.[0] ?? '';
      if (hint) first = await kakaoKeywordSearch(`${name} ${hint}`, apiKey);
    }

    if (!first) return empty;

    const mapped = mapKakaoCategoryByDomain(first.category_name || '', 'locations');
    return {
      address: first.road_address_name || first.address_name || '',
      lat: Number.parseFloat(first.y) || 0,
      lon: Number.parseFloat(first.x) || 0,
      kakao_place_id: first.id || null,
      category_main: mapped.main ?? null,
      category_sub: mapped.sub ?? null,
    };
  } catch {
    return empty;
  }
}

async function findExistingLocation(
  table: DomainTable,
  name: string,
  address: string,
  kakaoPlaceId: string | null,
): Promise<Record<string, unknown> | null> {
  const supabase = createServiceSupabase();

  if (kakaoPlaceId) {
    const byPid = await supabase
      .from(table)
      .select('*')
      .eq('kakao_place_id', kakaoPlaceId)
      .limit(1)
      .maybeSingle();
    if (!byPid.error && byPid.data) return byPid.data as Record<string, unknown>;
  }

  const byNameAddr = await supabase
    .from(table)
    .select('*')
    .eq('name', name)
    .eq('address', address)
    .limit(1)
    .maybeSingle();

  if (!byNameAddr.error && byNameAddr.data) return byNameAddr.data as Record<string, unknown>;
  return null;
}

async function ensureTagIds(tagNames: string[], tagDomain: TagDomain): Promise<string[]> {
  const supabase = createServiceSupabase();
  const ids: string[] = [];

  for (const rawName of tagNames) {
    const name = rawName.trim();
    if (!name) continue;

    const existing = await supabase
      .from('tags')
      .select('id, name')
      .eq('name', name)
      .eq('domain', tagDomain)
      .limit(1)
      .maybeSingle();

    if (!existing.error && existing.data?.id) {
      ids.push(existing.data.id as string);
      continue;
    }

    if (existing.error?.code === '42703') {
      const legacy = await supabase
        .from('tags')
        .select('id, name')
        .eq('name', name)
        .limit(1)
        .maybeSingle();
      if (!legacy.error && legacy.data?.id) {
        ids.push(legacy.data.id as string);
        continue;
      }
    }

    const created = await supabase
      .from('tags')
      .insert({ name, type: inferTagType(name), domain: tagDomain })
      .select('id')
      .single();

    if (created.error) {
      // legacy schema without domain
      const fallback = await supabase
        .from('tags')
        .insert({ name, type: inferTagType(name) })
        .select('id')
        .single();
      if (fallback.error?.code === '23505') {
        const duplicated = await supabase
          .from('tags')
          .select('id')
          .eq('name', name)
          .limit(1)
          .maybeSingle();
        if (!duplicated.error && duplicated.data?.id) ids.push(duplicated.data.id as string);
      } else if (!fallback.error && fallback.data?.id) {
        ids.push(fallback.data.id as string);
      }
      continue;
    }

    if (created.data?.id) ids.push(created.data.id as string);
  }

  return [...new Set(ids)];
}

async function syncLocationTagJoin(locationId: string, tagIds: string[], table: DomainTable): Promise<void> {
  const supabase = createServiceSupabase();
  const joinTable = table === 'attractions' ? 'attraction_tags' : 'location_tags';

  await supabase.from(joinTable).delete().eq('location_id', locationId);
  if (tagIds.length === 0) return;

  await supabase.from(joinTable).insert(
    tagIds.map((tagId) => ({
      location_id: locationId,
      tag_id: tagId,
    })),
  );
}

async function ensureLocationForPlace(input: InputPlace): Promise<{ domain: DomainTable; place: PlaceLike; created: boolean }> {
  const supabase = createServiceSupabase();

  const [enriched, kakao] = await Promise.all([
    enrichWithAi(input),
    searchKakaoPlace(input.name, input.note),
  ]);

  const mappedRegion = kakao.address ? extractRegionFromAddress(kakao.address) : null;
  const inferred = inferCategoryFromText(`${input.name} ${input.note}`);
  // 카카오 실제 업종 데이터 우선 → AI 보완 → 텍스트 추론 순서
  const categoryMain = kakao.category_main || enriched.category_main || inferred.category_main;
  const categorySub = kakao.category_sub || enriched.category_sub || inferred.category_sub;
  const domain = pickDomain(categoryMain);

  const tags = uniqueTags([
    ...enriched.tags,
    ...SITUATION_TAGS.filter((t) => input.note.includes(t)),
  ]);

  const curationLevel = enforceCurationRules(enriched, input.name, input.note);
  const existing = await findExistingLocation(domain, input.name, kakao.address, kakao.kakao_place_id);

  const basePayload = {
    name: input.name,
    region: mappedRegion?.region || '',
    sub_region: mappedRegion?.sub_region || null,
    category_main: categoryMain,
    category_sub: categorySub,
    lon: kakao.lon || 0,
    lat: kakao.lat || 0,
    address: kakao.address || '',
    memo: enriched.memo || input.note || '',
    short_desc: enriched.short_desc || null,
    rating: 0,
    curation_level: curationLevel,
    price_level: enriched.price_level,
    imageUrl: '',
    tags,
    event_tags: [] as string[],
    naver_place_id: null as string | null,
    kakao_place_id: kakao.kakao_place_id,
    curator_visited: true,
  };

  // locations 테이블에는 province 컬럼이 있으므로 추가
  const payload = domain === 'locations'
    ? { ...basePayload, province: mappedRegion?.province || '' }
    : basePayload;

  let row: Record<string, unknown>;
  let created = false;

  if (existing) {
    row = existing;
    const mergedTags = uniqueTags([...((existing.tags as string[] | undefined) ?? []), ...tags]);
    const { data: updated, error } = await supabase
      .from(domain)
      .update({
        ...payload,
        tags: mergedTags,
      })
      .eq('id', existing.id as string)
      .select('*')
      .single();
    if (error) {
      throw new Error(buildDbError('update', domain, input.name, error as SupabaseErrorLike));
    }
    row = updated as Record<string, unknown>;
  } else {
    const { data, error } = await supabase
      .from(domain)
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      throw new Error(buildDbError('insert', domain, input.name, error as SupabaseErrorLike));
    }
    row = data as Record<string, unknown>;
    created = true;
  }

  const tagIds = await ensureTagIds((row.tags as string[] | undefined) ?? tags, toTagDomain(domain));
  await syncLocationTagJoin(row.id as string, tagIds, domain);

  const place: PlaceLike = {
    id: row.id as string,
    name: (row.name ?? input.name) as string,
    region: (row.region ?? '') as string,
    sub_region: (row.sub_region ?? null) as string | null,
    category_main: (row.category_main ?? null) as string | null,
    category_sub: (row.category_sub ?? null) as string | null,
    lon: Number(row.lon ?? 0),
    lat: Number(row.lat ?? 0),
    address: (row.address ?? '') as string,
    memo: (row.memo ?? '') as string,
    short_desc: (row.short_desc ?? null) as string | null,
    rating: Number(row.rating ?? 0),
    price_level: (row.price_level ?? null) as number | null,
    tags: ((row.tags as string[] | null) ?? []),
    imageUrl: (row.imageUrl ?? row.image_url ?? '') as string,
    naver_place_id: (row.naver_place_id ?? null) as string | null,
    kakao_place_id: (row.kakao_place_id ?? null) as string | null,
  };

  return { domain, place, created };
}

function buildCourse(places: PlaceLike[]) {
  const steps = places.map((place, idx) => {
    const prev = idx > 0 ? places[idx - 1] : null;
    const distanceFromPrev = prev ? walkingDistanceMeters(prev, place) : null;
    return {
      label: `${idx + 1}코스`,
      place: {
        ...place,
        score: 0,
        scoreBreakdown: {
          vibeMatch: 0,
          distance: 0,
          jjeopLevel: 0,
          popularity: 0,
          season: 0,
          activityMatch: 0,
        },
      },
      distanceFromPrev,
    };
  });

  const totalDistance = steps.reduce((sum, step) => sum + (step.distanceFromPrev || 0), 0);
  const difficulty = totalDistance < 800 ? '★☆☆' : totalDistance < 1800 ? '★★☆' : '★★★';
  const vibes = uniqueTags(places.flatMap((p) => p.tags).filter((t) => inferTagType(t) === 'mood'));

  return {
    id: 1,
    steps,
    totalDistance,
    difficulty,
    mode: 'manual',
    vibes,
    totalScore: 0,
  };
}

export async function GET() {
  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from('odiga_saved_courses')
      .select('id, course_hash, source_query, region, activity_type, usage_count, validation_status, created_at, course_data')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[courses/build] GET error:', msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      course_title?: string;
      places?: InputPlace[];
      region_hint?: string;
    };

    const courseTitle = cleanText(body.course_title) || '관리자 수동 코스';
    const placesInput = (body.places ?? [])
      .map((p) => ({ name: cleanText(p.name), note: cleanText(p.note) }))
      .filter((p) => p.name.length > 0 && p.note.length > 0);

    if (placesInput.length < 2) {
      return NextResponse.json(
        { error: '최소 2개 이상의 코스 장소(이름 + 한줄 느낌)가 필요합니다.' },
        { status: 400 },
      );
    }

    const results = await Promise.allSettled(placesInput.map((p) => ensureLocationForPlace(p)));
    const errors: string[] = [];
    const resolved: { domain: DomainTable; place: PlaceLike; created: boolean }[] = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        resolved.push(r.value);
      } else {
        errors.push(`${placesInput[i].name}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
      }
    }

    if (resolved.length < 2) {
      return NextResponse.json(
        { error: `장소 처리 실패로 코스를 구성할 수 없습니다 (성공: ${resolved.length}개). 오류: ${errors.join('; ')}` },
        { status: 500 },
      );
    }

    const places = resolved.map((r) => r.place);
    const domains = resolved.map((r) => r.domain);

    const course = buildCourse(places);
    const placeIds = course.steps.map((s) => s.place.id);
    const courseHash = buildCourseHash(placeIds);
    const region =
      cleanText(body.region_hint)
      || places.find((p) => p.region)?.region
      || null;
    const activityType = places.some((p) => p.category_main === '카페') ? '카페' : '데이트코스';

    const supabase = createServiceSupabase();
    const now = new Date().toISOString();
    const { error: saveError } = await supabase
      .from('odiga_saved_courses')
      .upsert(
        {
          course_hash: courseHash,
          course_data: course,
          source_query: `${courseTitle}\n${placesInput.map((p) => `${p.name}: ${p.note}`).join('\n')}`,
          region,
          activity_type: activityType,
          vibe: course.vibes,
          season: null,
          people_count: 2,
          mode: 'manual',
          response_type: 'course',
          place_ids: placeIds,
          validation_status: 'verified',
          validation_reason: null,
          updated_at: now,
        },
        { onConflict: 'course_hash' },
      );

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      course_hash: courseHash,
      created_locations: resolved.filter((r) => r.created).length,
      reused_locations: resolved.filter((r) => !r.created).length,
      domains,
      errors: errors.length > 0 ? errors : undefined,
      places: places.map((p) => ({
        id: p.id,
        name: p.name,
        region: p.region,
        category_main: p.category_main,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[courses/build] POST error:', msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}
