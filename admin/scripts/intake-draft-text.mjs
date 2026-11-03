#!/usr/bin/env node
/**
 * 검토함 장소마다 "추천 문장 초안"을 미리 만들어 둔다 (service role, Mac mini의 Claude CLI 사용)
 *
 *   node scripts/intake-draft-text.mjs                 # 드라이런: 10곳만 만들어 화면에 보여준다 (저장 안 함)
 *   node scripts/intake-draft-text.mjs --apply         # 초안이 없는 검토 전 장소 전부 → place_intake.raw.draft
 *   node scripts/intake-draft-text.mjs --apply --limit 200
 *
 * 근거는 수집한 다른 곳 리뷰(external_reviews)·카카오 메모·분류뿐이다. 근거가 부족하면 초안을 비워 둔다.
 * 말투는 운영자가 인스타 맛집 글에 쓰는 문장(VOICE)에 맞춘다. STYLE이 바뀌면 예전 초안을 다시 만든다.
 * 검토함에서 가봤음/안 가봤지만 추천을 고르면 이 초안이 문장 칸에 미리 채워지고, 저장하면 추천 문장 '초안'(공개 안 됨)이 된다.
 */
import { env } from './lib/kakao.mjs';
import { MODEL, RULES, STYLE, askClaude, parseDrafts } from './lib/draft-voice.mjs';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : APPLY ? Infinity : 10;
const BATCH = 10;
const PARALLEL = 3;
const KEY = env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const api = async (pathAndQuery, init = {}) => {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...H, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathAndQuery.split('?')[0]} ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
};

function promptFor(items, rules) {
  const blocks = items.map((it) => {
    const reviews = (it.external_reviews ?? [])
      .map((r) => r.excerpt.replace(/\s+/g, ' ').trim().slice(0, 220))
      .filter(Boolean)
      .slice(0, 8);
    return JSON.stringify({
      id: it.id,
      name: it.name,
      category: it.raw?.kakao_category ?? it.category_hint,
      region: it.region_hint,
      operator_memo: it.raw?.memo ?? null,
      reviews,
    });
  });
  return `${rules}\n\n장소:\n${blocks.join('\n')}`;
}

async function loadTargets() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const page = await api(
      `place_intake?select=id,name,category_hint,region_hint,raw,external_reviews(excerpt)&status=eq.pending&order=collected_at.asc&offset=${from}&limit=500`,
    );
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows.filter((r) => r.raw?.draft?.style !== STYLE && (r.external_reviews?.length || r.raw?.memo)).slice(0, LIMIT);
}

async function main() {
  const targets = await loadTargets();
  const rules = RULES;
  console.error(`초안 만들 곳: ${targets.length}곳 (${APPLY ? '저장' : '드라이런'}, 모델 ${MODEL})`);
  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));

  const tally = { written: 0, empty: 0, failed: 0 };
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const items = batches[next++];
      try {
        const drafts = parseDrafts(await askClaude(promptFor(items, rules)), items);
        for (const d of drafts) {
          const it = items.find((i) => i.id === d.id);
          if (!APPLY) {
            console.log(`${it.name}\n  → ${d.body ?? '(근거 부족)'}${d.fits_for ? `\n  이럴 때: ${d.fits_for}` : ''}`);
            continue;
          }
          const draft = { body: d.body, fits_for: d.fits_for, from: 'external_reviews', style: STYLE, model: MODEL, generated_at: new Date().toISOString() };
          await api(`place_intake?id=eq.${d.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ raw: { ...it.raw, draft } }),
            headers: { Prefer: 'return=minimal' },
          });
          tally[d.body ? 'written' : 'empty'] += 1;
        }
      } catch (error) {
        tally.failed += items.length;
        console.error(`실패 (${items[0].name} 외 ${items.length - 1}곳): ${error.message}`);
      }
      if (APPLY) console.error(`진행 ${Math.min(next * BATCH, targets.length)}/${targets.length} · ${JSON.stringify(tally)}`);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry', targets: targets.length, ...tally }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
