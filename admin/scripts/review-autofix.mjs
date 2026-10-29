#!/usr/bin/env node
/**
 * admin "확인 필요" 중 규칙으로 정리할 수 있는 것을 정리한다 (service role)
 *
 *   node scripts/review-autofix.mjs           # 드라이런: 장소마다 무엇을 할지 docs/db-overhaul/review-autofix.json
 *   node scripts/review-autofix.mjs --apply   # 운영 DB 반영
 *
 * 운영자가 직접 볼 것(가봤는데 추천 이유 없음 · 공개 전 추천 문장 · 가봤는데 대표 사진 없음)은 건드리지 않는다.
 *
 *   폐업 의심   카카오에서 같은 이름(지점명 빼고도)으로 1km 안에 영업 중인 곳이 있으면 새 ID로 살리고, 없으면 숨김
 *   위치 바뀜   좌표를 고친 뒤 카카오 위치와 150m 안이면 해결(open)로
 *   장소 종류   카카오 분류로 장소 종류를 '제안'으로 붙인다 (운영자가 수정 화면에서 확인)
 *   중복 의심   데이터가 많은 한 곳(가봤음 > 공개 추천 > 사진 > 먼저 등록)만 남기고 나머지는 숨김
 *   정보 충돌   같은 출처끼리 엇갈리면 둘 다 '지난 정보'로 (근거 없이 한쪽을 고르지 않는다)
 * 행은 지우지 않는다. 숨김은 visit_status = hidden 이라 언제든 되돌릴 수 있다.
 */
import { writeFileSync } from 'fs';
import path from 'path';
import { REPO, cleanId, distanceM, env, keywordSearch, panel, sleep, squash, summarize } from './lib/kakao.mjs';

const APPLY = process.argv.includes('--apply');
const OUT = path.join(REPO, 'docs/db-overhaul/review-autofix.json');
const KEY = env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const api = async (pathAndQuery, init = {}) => {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...H, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathAndQuery.split('?')[0]} ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
};
const patch = (table, filter, body) => api(`${table}?${filter}`, { method: 'PATCH', body: JSON.stringify(body), headers: { Prefer: 'return=minimal' } });

/** 카카오 분류 → 장소 종류 (taxonomy place_type slug) */
const TYPE_RULES = [
  [/전망대/, 'viewpoint'],
  [/공원|수목원|정원|광장|섬|관광농원/, 'park'],
  [/도보여행|테마거리|거리|교량|다리|교차로/, 'street'],
  [/서점|도서관|책/, 'bookstore'],
  [/박물관/, 'museum'],
  [/미술|화랑|갤러리|문화시설|전시|공연/, 'gallery'],
  [/궁|유적|사찰|왕릉/, 'heritage'],
  [/시장/, 'market'],
  [/문구|생활용품|인테리어|가구|장난감|꽃집|음반|음향|수예|편집|소품|백화점|쇼핑몰|사진관/, 'shop'],
  [/카페/, 'cafe'],
  [/베이커리|디저트|제과/, 'bakery'],
  [/술집|호프|바\b/, 'bar'],
  [/음식점|식당/, 'restaurant'],
];

async function main() {
  const [places, terms, dups, conflicts, untyped] = await Promise.all([
    (async () => {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const page = await api(`places?select=id,name,lat,lon,address,kakao_place_id,visit_status,business_status,image_url,created_at,category_main,category_sub,recommendations(status),visits(id)&offset=${from}&limit=1000`);
        rows.push(...page);
        if (page.length < 1000) break;
      }
      return rows;
    })(),
    api('taxonomy_terms?select=id,slug&kind=eq.place_type'),
    api('curation_review_duplicates?select=*'),
    api('curation_review_fact_conflicts?select=*'),
    api('curation_review_untyped_places?select=id'),
  ]);
  const byId = new Map(places.map((p) => [p.id, p]));
  const termId = new Map(terms.map((t) => [t.slug, t.id]));
  const actions = [];

  // ── 폐업 의심 ──
  // 운영자가 이미 숨긴 폐업(closed)도 한 번 더 본다. 살아 있으면 방문 기록 여부로 원래 상태를 되돌린다
  for (const p of places.filter((x) => x.business_status === 'closed_suspect' || x.business_status === 'closed')) {
    const names = [p.name, p.name.replace(/\s*\S+점$/, '')].filter((n, i, a) => n && a.indexOf(n) === i);
    let revived = null;
    for (const name of names) {
      const docs = [...(await keywordSearch(name, p).catch(() => [])), ...(await keywordSearch(name, null).catch(() => []))];
      for (const d of docs) {
        if (!squash(d.place_name).startsWith(squash(name))) continue;
        const dist = distanceM(p, { lat: Number(d.y), lon: Number(d.x) });
        if (dist == null || dist > 1000) continue;
        const k = await panel(d.id).catch(() => null);
        if (k && summarize(k).status === 'Y') {
          revived = { kakao_place_id: d.id, name: d.place_name, distance_m: dist };
          break;
        }
      }
      if (revived) break;
      await sleep(150);
    }
    actions.push(revived
      ? { kind: 'closed_revive', id: p.id, name: p.name, detail: revived, patch: { kakao_place_id: revived.kakao_place_id, business_status: 'open', business_checked_at: new Date().toISOString(), ...(p.visit_status === 'hidden' ? { visit_status: p.visits?.length ? 'visited' : 'candidate' } : {}) } }
      : p.visit_status === 'hidden' && p.business_status === 'closed'
        ? { kind: 'closed_confirmed', id: p.id, name: p.name }
        : { kind: 'closed_hide', id: p.id, name: p.name, patch: { visit_status: 'hidden', business_status: 'closed', business_checked_at: new Date().toISOString() } });
  }

  // ── 위치 바뀜 ──
  for (const p of places.filter((x) => x.business_status === 'moved')) {
    const raw = p.kakao_place_id ? await panel(cleanId(p.kakao_place_id)).catch(() => null) : null;
    const k = raw ? summarize(raw) : null;
    const dist = k ? distanceM(p, k) : null;
    if (k && dist != null && dist <= 150) {
      actions.push({ kind: 'moved_resolved', id: p.id, name: p.name, detail: { distance_m: dist }, patch: { business_status: 'open', business_checked_at: new Date().toISOString() } });
    } else if (k) {
      actions.push({ kind: 'moved_fix', id: p.id, name: p.name, detail: { distance_m: dist, address: k.address }, patch: { lat: k.lat, lon: k.lon, address: k.address, business_status: 'open', business_checked_at: new Date().toISOString() } });
    }
    await sleep(150);
  }

  // ── 장소 종류 없음 → 제안 ──
  for (const { id } of untyped) {
    const p = byId.get(id);
    if (!p) continue;
    const raw = p.kakao_place_id ? await panel(cleanId(p.kakao_place_id)).catch(() => null) : null;
    const category = [raw ? summarize(raw).category : null, p.category_main, p.category_sub].filter(Boolean).join(' > ');
    // 분류로 못 정하면 이름도 본다 (예: '올림픽공원 들꽃마루' → 공원)
    const rule = TYPE_RULES.find(([re]) => re.test(category)) ?? TYPE_RULES.find(([re]) => re.test(p.name));
    actions.push(rule && termId.get(rule[1])
      ? { kind: 'type_suggest', id, name: p.name, detail: { category, slug: rule[1] }, term: { place_id: id, term_id: termId.get(rule[1]), status: 'suggested', source: 'rule', evidence: `카카오 분류: ${category}` } }
      : { kind: 'type_unknown', id, name: p.name, detail: { category } });
    await sleep(100);
  }

  // ── 중복 의심 ──
  const score = (p) => (p.visit_status === 'visited' ? 8 : 0) + (p.recommendations?.some((r) => r.status === 'published') ? 4 : 0) + (p.image_url ? 2 : 0) + (p.kakao_place_id ? 1 : 0);
  for (const group of dups) {
    const members = group.place_ids.map((id) => byId.get(id)).filter(Boolean).filter((p) => p.visit_status !== 'hidden');
    if (members.length < 2) continue;
    const keep = [...members].sort((a, b) => score(b) - score(a) || a.created_at.localeCompare(b.created_at))[0];
    for (const p of members.filter((m) => m.id !== keep.id && !actions.some((a) => a.kind === 'dup_hide' && a.id === m.id))) {
      // 숨기는 쪽이 가봤음이면 남기는 쪽도 가봤음으로 (방문 기록을 잃지 않게)
      actions.push({ kind: 'dup_hide', id: p.id, name: p.name, detail: { keep: keep.id, keep_name: keep.name, by: group.matched_by }, patch: { visit_status: 'hidden' } });
      if (p.visit_status === 'visited' && keep.visit_status !== 'visited') {
        actions.push({ kind: 'dup_keep_visited', id: keep.id, name: keep.name, patch: { visit_status: 'visited' } });
        keep.visit_status = 'visited';
      }
    }
  }

  // ── 정보 충돌 ──
  for (const c of conflicts) {
    actions.push({ kind: 'fact_outdate', id: c.place_id, name: byId.get(c.place_id)?.name, detail: { field: c.field, values: c.values }, factFilter: `place_id=eq.${c.place_id}&field=eq.${c.field}` });
  }

  const tally = actions.reduce((acc, a) => ({ ...acc, [a.kind]: (acc[a.kind] ?? 0) + 1 }), {});
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), tally, actions }, null, 1));
  console.log(JSON.stringify(tally));
  console.log(`saved ${path.relative(REPO, OUT)}`);
  if (!APPLY) return;

  let done = 0;
  for (const a of actions) {
    if (a.patch) await patch('places', `id=eq.${a.id}`, { ...a.patch, updated_at: new Date().toISOString() });
    if (a.term) await api('place_terms?on_conflict=place_id,term_id', { method: 'POST', body: JSON.stringify(a.term), headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' } });
    if (a.factFilter) await patch('place_facts', a.factFilter, { status: 'outdated' });
    done += 1;
  }
  console.log(`applied ${done}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
