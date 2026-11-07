#!/usr/bin/env node
/**
 * 이미 모은 리뷰를 원문 전체로 다시 받는다 (external_reviews).
 * 예전 수집기는 panel3 미리보기라 카카오 리뷰 3개, 300자에서 잘렸고, 블로그는 카카오 미리보기만 있었다.
 *
 *   node scripts/reviews-full-backfill.mjs                    # 드라이런: 대상 수만
 *   node scripts/reviews-full-backfill.mjs --apply            # 장소(places) 전부, 가본 곳 먼저
 *   node scripts/reviews-full-backfill.mjs --apply --intakes  # 검토함(아직 결정 안 한 항목)도
 *   node scripts/reviews-full-backfill.mjs --apply --only <place_id>
 *   옵션: --limit N (이번에 처리할 곳 수) · --gap 3000 (곳 사이 쉬는 ms) · --redo (이미 한 곳도 다시)
 *
 * 천천히 돈다: 요청 사이 0.6초, 곳 사이 3초. 끊겨도 다시 돌리면 한 곳은 건너뛴다 (.reviews-backfill/state.json).
 * 같은 리뷰(source, external_id)는 원문으로 덮어쓴다 (merge-duplicates).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanId, env, fullReviews, reviewRows, sleep } from './lib/kakao.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.resolve(HERE, '../.reviews-backfill');
const STATE = path.join(STATE_DIR, 'state.json');
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const APPLY = args.includes('--apply');
const INTAKES = args.includes('--intakes');
const REDO = args.includes('--redo');
const ONLY = opt('--only');
const LIMIT = Number(opt('--limit') ?? Infinity);
const GAP = Number(opt('--gap') ?? 3000);

const KEY = env.SUPABASE_SERVICE_KEY;
const BASE = `${env.VITE_SUPABASE_URL}/rest/v1`;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function getAll(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${BASE}/${query}&offset=${from}&limit=1000`, { headers });
    if (!res.ok) throw new Error(`${query.split('?')[0]} ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function upsert(rows) {
  for (let i = 0; i < rows.length; i += 100) {
    const res = await fetch(`${BASE}/external_reviews?on_conflict=source,external_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 100)),
    });
    if (!res.ok) throw new Error(`external_reviews ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

const readState = () => {
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'));
  } catch {
    return { done: {} };
  }
};

async function targets() {
  const rank = { visited: 0, planned: 1 };
  const places = (await getAll('places?select=id,name,kakao_place_id,visit_status&kakao_place_id=not.is.null&visit_status=neq.hidden&order=id'))
    .filter((p) => !ONLY || p.id === ONLY)
    .sort((a, b) => (rank[a.visit_status] ?? 2) - (rank[b.visit_status] ?? 2))
    .map((p) => ({ key: `place:${p.id}`, name: p.name, kakao: cleanId(p.kakao_place_id), extra: { place_id: p.id } }));
  if (!INTAKES || ONLY) return places;
  const intakes = (await getAll('place_intake?select=id,name,kakao_place_id,matched_place_id&kakao_place_id=not.is.null&status=eq.pending&order=collected_at'))
    .map((it) => ({
      key: `intake:${it.id}`,
      name: it.name,
      kakao: cleanId(it.kakao_place_id),
      extra: { intake_id: it.id, ...(it.matched_place_id ? { place_id: it.matched_place_id } : {}) },
    }));
  return [...places, ...intakes];
}

async function main() {
  const state = readState();
  const all = await targets();
  const todo = all.filter((t) => t.kakao && (REDO || ONLY || !state.done[t.key])).slice(0, LIMIT);
  console.log(JSON.stringify({ targets: all.length, already: Object.keys(state.done).length, this_run: todo.length }));
  if (!APPLY) return;
  mkdirSync(STATE_DIR, { recursive: true });

  let n = 0;
  let rowsTotal = 0;
  const failures = [];
  for (const t of todo) {
    n += 1;
    try {
      const full = await fullReviews(t.kakao);
      const rows = reviewRows(full, t.extra, `https://place.map.kakao.com/${t.kakao}`);
      if (rows.length) await upsert(rows);
      rowsTotal += rows.length;
      state.done[t.key] = { at: new Date().toISOString(), kakao: full.reviews.length, blogs: full.blogs.length, blog_full: full.blogs.filter((b) => b.full).length };
      writeFileSync(STATE, JSON.stringify(state));
      console.log(`${n}/${todo.length} ${t.name} 카카오 ${full.reviews.length} 블로그 ${full.blogs.length}`);
    } catch (error) {
      failures.push(`${t.name}: ${error.message}`);
      console.log(`${n}/${todo.length} ${t.name} 실패: ${error.message}`);
      // 연속으로 막히면(차단 의심) 오래 쉰다
      if (failures.length >= 5 && failures.length % 5 === 0) await sleep(10 * 60 * 1000);
    }
    await sleep(GAP);
  }
  console.log(JSON.stringify({ done: n - failures.length, rows: rowsTotal, failures: failures.slice(0, 20) }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
