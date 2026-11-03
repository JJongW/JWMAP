#!/usr/bin/env node
/**
 * 직접 다녀왔는데 공개된 추천 이유가 없는 곳 → 추천 이유 초안 (service role, Mac mini의 Claude CLI 사용)
 *
 *   node scripts/reason-drafts.mjs                  # 드라이런: 10곳만 만들어 화면에 보여준다 (저장 안 함)
 *   node scripts/reason-drafts.mjs --apply          # 초안이 없는 곳 전부 → recommendations (status draft, source ai_draft)
 *   node scripts/reason-drafts.mjs --apply --limit 100
 *
 * 근거: 수집해 둔 카카오 리뷰·블로그 리뷰(external_reviews)와 운영자가 남긴 메모(source_notes 중 운영자 글)뿐이다.
 * 근거가 부족하면 초안을 만들지 않는다. 초안은 사이트에 나가지 않고, admin 확인 필요 목록에서 고쳐 공개한다.
 * 말투·규칙은 검토함 초안과 같다 (lib/draft-voice.mjs).
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

/** 운영자가 직접 쓴 메모만 근거로 준다 (자동 정리 문구는 빼고) */
const operatorNotes = (notes) =>
  (notes ?? []).filter((n) => n.classified_as === 'operator_note' && n.raw_text?.trim()).map((n) => n.raw_text.trim().slice(0, 300));

function promptFor(items) {
  const blocks = items.map((it) => {
    // 카카오 리뷰를 먼저, 블로그는 뒤에 (블로그는 협찬 글이 섞여 있어 보조로)
    const reviews = [...it.external_reviews]
      .sort((a, b) => (a.source === 'kakao' ? 0 : 1) - (b.source === 'kakao' ? 0 : 1))
      .map((r) => r.excerpt.replace(/\s+/g, ' ').trim().slice(0, 220))
      .filter(Boolean)
      .slice(0, 10);
    return JSON.stringify({
      id: it.id,
      name: it.name,
      category: [it.category_main, it.category_sub].filter(Boolean).join(' > ') || null,
      region: it.region,
      operator_memo: operatorNotes(it.source_notes).join(' / ') || null,
      reviews,
    });
  });
  return `${RULES}\n\n장소:\n${blocks.join('\n')}`;
}

async function loadTargets() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const page = await api(
      `places?select=id,name,region,category_main,category_sub,recommendations(status),external_reviews(source,excerpt),source_notes(classified_as,raw_text)` +
        `&visit_status=eq.visited&order=id&offset=${from}&limit=500`,
    );
    rows.push(...page);
    if (page.length < 500) break;
  }
  // 공개 문장이나 확인 전 초안이 이미 있는 곳은 건드리지 않는다
  return rows
    .filter((p) => !p.recommendations.some((r) => r.status === 'published' || r.status === 'draft'))
    .filter((p) => p.external_reviews.length >= 2 || operatorNotes(p.source_notes).length > 0)
    .slice(0, LIMIT);
}

async function main() {
  const targets = await loadTargets();
  console.error(`초안 만들 곳: ${targets.length}곳 (${APPLY ? '저장' : '드라이런'}, 모델 ${MODEL})`);
  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));

  const tally = { written: 0, empty: 0, failed: 0 };
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const items = batches[next++];
      try {
        const drafts = parseDrafts(await askClaude(promptFor(items)), items);
        for (const d of drafts) {
          const it = items.find((i) => i.id === d.id);
          if (!APPLY) {
            console.log(`${it.name}\n  → ${d.body ?? '(근거 부족)'}${d.fits_for ? `\n  이럴 때: ${d.fits_for}` : ''}`);
            continue;
          }
          if (!d.body) {
            tally.empty += 1;
            continue;
          }
          await api('recommendations', {
            method: 'POST',
            body: JSON.stringify({ place_id: d.id, body: d.body, fits_for: d.fits_for, status: 'draft', source: 'ai_draft', basis: 'visited' }),
            headers: { Prefer: 'return=minimal' },
          });
          tally.written += 1;
        }
      } catch (error) {
        tally.failed += items.length;
        console.error(`실패 (${items[0].name} 외 ${items.length - 1}곳): ${error.message}`);
      }
      if (APPLY) console.error(`진행 ${Math.min(next * BATCH, targets.length)}/${targets.length} · ${JSON.stringify(tally)}`);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry', style: STYLE, targets: targets.length, ...tally }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
