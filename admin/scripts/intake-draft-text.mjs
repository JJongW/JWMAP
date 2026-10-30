#!/usr/bin/env node
/**
 * 검토함 장소마다 "추천 문장 초안"을 미리 만들어 둔다 (service role, Mac mini의 Claude CLI 사용)
 *
 *   node scripts/intake-draft-text.mjs                 # 드라이런: 10곳만 만들어 화면에 보여준다 (저장 안 함)
 *   node scripts/intake-draft-text.mjs --apply         # 초안이 없는 검토 전 장소 전부 → place_intake.raw.draft
 *   node scripts/intake-draft-text.mjs --apply --limit 200
 *
 * 근거는 수집한 다른 곳 리뷰(external_reviews)·카카오 메모·분류뿐이다. 근거가 부족하면 초안을 비워 둔다.
 * 검토함에서 가봤음/안 가봤지만 추천을 고르면 이 초안이 문장 칸에 미리 채워지고, 저장하면 추천 문장 '초안'(공개 안 됨)이 된다.
 */
import { spawn } from 'child_process';
import { env } from './lib/kakao.mjs';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : APPLY ? Infinity : 10;
const BATCH = 10;
const PARALLEL = 3;
const MODEL = process.env.DRAFT_MODEL ?? 'haiku';
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';

const KEY = env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const api = async (pathAndQuery, init = {}) => {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...H, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathAndQuery.split('?')[0]} ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
};

const RULES = `너는 서울 장소 큐레이션 사이트 운영자의 메모 정리를 돕는다.
각 장소에 대해, 주어진 리뷰·메모·분류에 실제로 적힌 내용만 근거로 "추천하는 이유" 초안을 쓴다.
- 한국어 해요체, 1~2문장, 90자 이내. 무엇이 좋다는 평이 많은지(메뉴·분위기·공간·서비스)를 구체적으로.
- 리뷰 문장을 그대로 옮기지 말고 요약한다. 리뷰에 없는 메뉴·가격·특징은 지어내지 않는다.
- "제가 가봤는데", "직접 먹어보니"처럼 방문을 주장하지 않는다. 별점·리뷰 수·"인기 많은" 같은 일반 수식은 쓰지 않는다.
- fits_for: 리뷰에 근거가 있을 때만 "이럴 때 좋아요"를 짧게 (예: "조용히 작업하고 싶을 때"). 없으면 null.
- 근거가 빈약하면(리뷰가 "맛있어요" 수준뿐) body를 null로.
출력은 JSON 배열 하나만: [{"id": "...", "body": "..." 또는 null, "fits_for": "..." 또는 null}]`;

function promptFor(items) {
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
  return `${RULES}\n\n장소:\n${blocks.join('\n')}`;
}

function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    // /tmp에서 실행 → 이 저장소의 CLAUDE.md를 읽지 않는다
    const child = spawn(CLAUDE_BIN, ['-p', prompt, '--model', MODEL, '--output-format', 'text', '--no-session-persistence', '--tools', ''], {
      cwd: '/tmp',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`claude 종료 코드 ${code}: ${err.slice(-300)}`))));
  });
}

function parse(text, items) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('JSON 배열이 없어요');
  const ids = new Set(items.map((i) => i.id));
  const clean = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  return JSON.parse(text.slice(start, end + 1))
    .filter((r) => ids.has(r.id))
    .map((r) => ({ id: r.id, body: clean(r.body, 200), fits_for: clean(r.fits_for, 80) }));
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
  return rows.filter((r) => !r.raw?.draft && (r.external_reviews?.length || r.raw?.memo)).slice(0, LIMIT);
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
        const drafts = parse(await askClaude(promptFor(items)), items);
        for (const d of drafts) {
          const it = items.find((i) => i.id === d.id);
          if (!APPLY) {
            console.log(`${it.name}\n  → ${d.body ?? '(근거 부족)'}${d.fits_for ? `\n  이럴 때: ${d.fits_for}` : ''}`);
            continue;
          }
          const draft = { body: d.body, fits_for: d.fits_for, from: 'external_reviews', model: MODEL, generated_at: new Date().toISOString() };
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
