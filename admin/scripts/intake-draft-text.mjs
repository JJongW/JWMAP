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
import { spawn } from 'child_process';
import { env } from './lib/kakao.mjs';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : APPLY ? Infinity : 10;
const BATCH = 10;
const PARALLEL = 3;
const MODEL = process.env.DRAFT_MODEL ?? 'haiku';
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';
const STYLE = 'operator-voice-v4';

/** 운영자 인스타 맛집 글에서 고른 문장 (말투 예시) */
const VOICE = [
  '여태 5번째인데 역시나 맛있는 피자집이다.',
  '흔히 크러스트라고 하는 엣지부분이 맛있었다? 그럼 끝이다 나에겐.',
  '짼든 그렇게 들어가서 먹었는데 아니 너무 맛있자나..?',
  '양배추부터 마요네즈 살짝에 간장소스같은게 있는데 이거 그냥 너무 맛있었고',
  '다음에 가게되면 무조건 예약하고 가는걸로🙃',
  '가자마자 웨이팅부터 해버리는 무시무시한 곳.',
  '여긴 서비스부터 음식 맛까지 고급진 곳이다.',
  '항상 앱으로 웨이팅 확인하면서 오면 좋을 듯하다. 참고로 안에 피클이 있으니 오이 싫어하면 부탁드리면 될 듯!!',
  '바질좋아하는 사람이 있다면 바질크림치즈도 좋음.',
  '작업하는 곳이 작업하기에도 좋은데 커피도 맛있다..?',
  '커피랑 디저트의 종류는 정말 단순한데 맛있다.',
  '진짜 내부 딱 들어오면 깔끔한 느낌이라 넘 좋다.',
];

const KEY = env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const api = async (pathAndQuery, init = {}) => {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...H, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathAndQuery.split('?')[0]} ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
};

const RULES = `너는 서울 장소 큐레이션 사이트 운영자 대신 "추천하는 이유" 초안을 쓴다. 운영자가 나중에 고쳐서 공개한다.
내용은 주어진 리뷰·메모·분류에 실제로 적힌 것만 쓰고, 말투는 아래 운영자 문장과 똑같이 쓴다.

운영자 문장 (인스타 맛집 글):
${VOICE.map((v) => `- ${v}`).join('\n')}

말투:
- 반말 평서체 "~다." "~이다." "~좋다." "~듯!!"로 끝낸다. 해요체, "~음/~함" 메모체, "~라는 평이 많아요" 같은 정리체는 쓰지 않는다.
- 친구한테 말하듯 솔직하게. "너무", "넘", "진짜", "무조건", "고급진", "~자나..?", "..", "ㅎㅎ"를 자연스럽게 가끔. 이모지는 거의 안 쓴다.
- 2~3문장, 120자 안팎. 꼭 먹어볼 메뉴나 공간 특징을 콕 집는다. 쓸 만한 팁(웨이팅·예약·자리·주의할 점)은 리뷰에 있을 때만 붙인다.
- 담백한 설명문이 되지 않게 운영자 특유의 감탄과 너스레를 한 문장에는 꼭 넣는다 (예: "아니 이게 맛있자나..?", "그럼 끝이다.", "넘 좋다", "고급진 맛이다", "ㅎㅎ").
- 위치·거리·출구 같은 길 안내로 시작하지 않는다. 맛이나 공간 이야기로 바로 시작한다.
- 끝맺음을 장소마다 다르게. "참고하면 좋을 듯!!"·"좋을 듯!!"은 열 곳에 한두 번만. "~다.", "그럼 끝이다.", "~자나..?", "~는 걸로", "넘 좋다" 등 섞어 쓴다.
- "후기", "리뷰", "~라고 한다", "~라는 평"처럼 남의 말을 옮기는 표현은 쓰지 않는다. 운영자가 아는 것처럼 바로 말한다.
내용:
- 리뷰 문장을 그대로 옮기지 말고 요약한다. 리뷰에 없는 메뉴·가격·특징은 지어내지 않는다.
- 운영자가 겪은 구체적인 일은 지어내지 않는다 (몇 번째 방문, 누구랑 갔는지, 언제 갔는지, "내가 제일 좋아하는" 등). 맛·공간 평가는 운영자 말투로 써도 된다.
- 별점·리뷰 수·"인기 많은"·"맛집으로 유명"·방송 출연 같은 일반 수식은 쓰지 않는다.
- fits_for: 리뷰에 근거가 있을 때만 짧게 (예: "혼자 작업하고 싶을 때"). 없으면 null.
- 근거가 빈약하면(리뷰가 "맛있어요" 수준뿐) body를 null로.
출력은 JSON 배열 하나만: [{"id": "...", "body": "..." 또는 null, "fits_for": "..." 또는 null}]`;

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
        const drafts = parse(await askClaude(promptFor(items, rules)), items);
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
