/**
 * 추천 문장 초안 공용: 운영자 말투(VOICE)·규칙(RULES)·Claude CLI 호출·결과 읽기.
 * 검토함 초안(intake-draft-text.mjs)과 가본 곳 추천 이유 초안(reason-drafts.mjs)이 같은 말투를 쓰도록 한곳에 둔다.
 */
import { spawn } from 'child_process';

export const MODEL = process.env.DRAFT_MODEL ?? 'haiku';
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';
export const STYLE = 'operator-voice-v4';

/** 운영자 인스타 맛집 글에서 고른 문장 (말투 예시) */
export const VOICE = [
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

export const RULES = `너는 서울 장소 큐레이션 사이트 운영자 대신 "추천하는 이유" 초안을 쓴다. 운영자가 나중에 고쳐서 공개한다.
내용은 주어진 리뷰, 메모, 분류에 실제로 적힌 것만 쓰고, 말투는 아래 운영자 문장과 똑같이 쓴다.

운영자 문장 (인스타 맛집 글):
${VOICE.map((v) => `- ${v}`).join('\n')}

말투:
- 반말 평서체 "~다." "~이다." "~좋다." "~듯!!"로 끝낸다. 해요체, "~음/~함" 메모체, "~라는 평이 많아요" 같은 정리체는 쓰지 않는다.
- 친구한테 말하듯 솔직하게. "너무", "넘", "진짜", "무조건", "고급진", "~자나..?", "..", "ㅎㅎ"를 자연스럽게 가끔. 이모지는 거의 안 쓴다.
- 2~3문장, 120자 안팎. 꼭 먹어볼 메뉴나 공간 특징을 콕 집는다. 쓸 만한 팁(웨이팅, 예약, 자리, 주의할 점)은 리뷰에 있을 때만 붙인다.
- 담백한 설명문이 되지 않게 운영자 특유의 감탄과 너스레를 한 문장에는 꼭 넣는다 (예: "아니 이게 맛있자나..?", "그럼 끝이다.", "넘 좋다", "고급진 맛이다", "ㅎㅎ").
- 위치, 거리, 출구 같은 길 안내로 시작하지 않는다. 맛이나 공간 이야기로 바로 시작한다.
- 끝맺음을 장소마다 다르게. "참고하면 좋을 듯!!"과 "좋을 듯!!"은 열 곳에 한두 번만. "~다.", "그럼 끝이다.", "~자나..?", "~는 걸로", "넘 좋다" 등 섞어 쓴다.
- 가운데점(·)으로 낱말을 잇지 않는다. 나열은 "와/과", 쉼표, 문장으로 풀어 쓴다.
- "후기", "리뷰", "~라고 한다", "~라는 평"처럼 남의 말을 옮기는 표현은 쓰지 않는다. 운영자가 아는 것처럼 바로 말한다.
내용:
- 리뷰 문장을 그대로 옮기지 말고 요약한다. 리뷰에 없는 메뉴, 가격, 특징은 지어내지 않는다.
- 운영자가 겪은 구체적인 일은 지어내지 않는다 (몇 번째 방문, 누구랑 갔는지, 언제 갔는지, "내가 제일 좋아하는" 등). 맛과 공간 평가는 운영자 말투로 써도 된다.
- 별점, 리뷰 수, "인기 많은", "맛집으로 유명", 방송 출연 같은 일반 수식은 쓰지 않는다.
- fits_for: 리뷰에 근거가 있을 때만 짧게 (예: "혼자 작업하고 싶을 때"). 없으면 null.
- 근거가 빈약하면(리뷰가 "맛있어요" 수준뿐) body를 null로.
출력은 JSON 배열 하나만: [{"id": "...", "body": "..." 또는 null, "fits_for": "..." 또는 null}]`;

export function askClaude(prompt) {
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

export function parseDrafts(text, items) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('JSON 배열이 없어요');
  const ids = new Set(items.map((i) => i.id));
  // 가운데점(U+00B7)으로 이은 초안은 사이트에 그대로 나가지 않게 버린다 (다음 실행에서 다시 쓴다). 글자를 바꿔 끼우지 않는다
  const clean = (v, max) => (typeof v === 'string' && v.trim() && !v.includes('\u00B7') ? v.trim().slice(0, max) : null);
  return JSON.parse(text.slice(start, end + 1))
    .filter((r) => ids.has(r.id))
    .map((r) => ({ id: r.id, body: clean(r.body, 200), fits_for: clean(r.fits_for, 80) }));
}

