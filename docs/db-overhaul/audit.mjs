// DB 개편 Phase 0-3: 현재 DB 상태 감사 (읽기 전용)
// 사용법: node docs/db-overhaul/audit.mjs > docs/db-overhaul/audit-YYYY-MM-DD.md
// project/.env의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 읽는다. 쓰기 요청은 하지 않는다.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = Object.fromEntries(
  readFileSync(join(root, 'project', '.env'), 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' };

async function get(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  return { ok: res.ok, range: res.headers.get('content-range'), body: res.ok ? await res.json() : null };
}

const isFilled = (v) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
const top = (rows, field, n = 12) => {
  const counts = {};
  rows.forEach((row) => { counts[row[field]] = (counts[row[field]] ?? 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}:${v}`).join(' · ');
};
const ADDRESS = /^(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|충청|전북|전남|전라|경북|경남|경상|제주)\S*\s.*\d/;
const AUTO_MEMO = /분위기:|방문 많음/;

const out = [`# DB 감사 — ${new Date().toISOString().slice(0, 10)}`, ''];

out.push('## 테이블 행 수', '', '| 테이블 | 행 수 |', '|---|---|');
for (const table of ['locations', 'attractions', 'tags', 'location_tags', 'attraction_tags', 'regions', 'categories', 'location_images', 'reviews', 'user_place_states', 'click_logs', 'search_logs', 'odiga_search_logs', 'place_candidates', 'generated_drafts', 'daily_checklist']) {
  const r = await get(`${table}?select=*&limit=1`);
  out.push(`| ${table} | ${r.ok ? r.range?.split('/')[1] : '접근 불가'} |`);
}

const loc = (await get('locations?select=*&limit=10000')).body ?? [];
out.push('', `## locations (${loc.length}곳) 컬럼 채움`, '', '| 컬럼 | 채워짐 |', '|---|---|');
Object.keys(loc[0] ?? {}).forEach((field) => out.push(`| ${field} | ${loc.filter((row) => isFilled(row[field])).length} |`));

const visited = loc.filter((row) => row.curator_visited);
const shortDescs = loc.filter((row) => row.short_desc?.trim());
const cafeLike = loc.filter((row) => ['카페', '디저트'].includes(row.category_main));
const dupKakao = Object.values(loc.reduce((acc, row) => { if (row.kakao_place_id) acc[row.kakao_place_id] = (acc[row.kakao_place_id] ?? 0) + 1; return acc; }, {})).filter((n) => n > 1).length;

out.push('', '## 핵심 지표', '',
  `- 운영자 방문: ${visited.length} / 미방문: ${loc.length - visited.length}`,
  `- short_desc ${shortDescs.length}개 중 주소로 보이는 것: ${shortDescs.filter((row) => ADDRESS.test(row.short_desc.trim())).length}`,
  `- 실제 운영자 한 줄(주소 아닌 short_desc): ${shortDescs.filter((row) => !ADDRESS.test(row.short_desc.trim())).length}`,
  `- memo 자동 생성 문구: ${loc.filter((row) => AUTO_MEMO.test(row.memo ?? '')).length}`,
  `- 방문했는데 kakao_place_id 없음: ${visited.filter((row) => !row.kakao_place_id).length}`,
  `- 카페+디저트: ${cafeLike.length} (${Math.round((cafeLike.length / loc.length) * 100)}%)`,
  `- kakao_place_id 중복: ${dupKakao}`,
  '',
  `- category_main: ${top(loc, 'category_main')}`,
  `- province: ${top(loc, 'province')}`,
  `- curation_level: ${top(loc, 'curation_level')}`,
);

console.log(out.join('\n'));
