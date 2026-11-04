#!/usr/bin/env node
/**
 * Figma 「제작 현황」 페이지의 체크를 읽는다 → 장소별로 단일/묶음 카드뉴스를 만들었는지.
 *
 *   node scripts/card-checklist-read.mjs            # JSON 출력
 *   node scripts/card-checklist-read.mjs --unused single            # 단일 게시물을 아직 안 만든 place_id만
 *   node scripts/card-checklist-read.mjs --unused multi             # 묶음에 한 번도 안 들어간 place_id만
 *   node scripts/card-checklist-read.mjs --check                    # 토큰 점검: 안 되거나 곧 만료되면 맥 알림
 *
 * 목록 구조 (Figma 파일 oTmjexkwnDyPutL1qYJqrU, 보드 27:27 「카드뉴스 제작 현황」):
 *   줄 이름 = place_id
 *   칸 「단일」: Check 컴포넌트(boolean 속성 checked) — 이 장소 하나만 소개한 게시물을 올렸는지
 *   칸 「묶음」: 숫자 글자 — 여러 곳 묶음 게시물에 들어간 횟수 (한 장소가 여러 묶음에 들어갈 수 있다)
 *   칸 「올린 게시물 (메모)」: 글자 — 메모
 * 토큰은 project/.env 또는 admin/.env.local 의 FIGMA_READ_TOKEN (Figma 개인 토큰, file_content:read). 출력에 토큰을 찍지 않는다.
 * 개인 토큰은 30일이면 만료된다. 만든 날을 FIGMA_READ_TOKEN_SET_AT=YYYY-MM-DD 로 적어 두면 만료 5일 전부터 미리 알린다.
 * 토큰이 거부되면(401/403) 언제든 바로 알린다. 알림은 macOS 알림 센터(osascript)로 보낸다.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const FILE_KEY = 'oTmjexkwnDyPutL1qYJqrU';
const BOARD_ID = '27:27';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function readEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
        .map((line) => {
          const i = line.indexOf('=');
          return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...readEnv(path.join(REPO, 'project/.env')), ...readEnv(path.join(REPO, 'admin/.env.local')), ...process.env };
const TOKEN = env.FIGMA_READ_TOKEN || env.FIGMA_TOKEN;

const checked = (cell) => {
  const inst = cell?.children?.find((c) => c.type === 'INSTANCE');
  const prop = inst && Object.entries(inst.componentProperties ?? {}).find(([k]) => k.startsWith('checked'));
  return Boolean(prop && prop[1].value);
};

/** 보드 JSON(Figma REST 노드 문서) → { place_id: { name, single, multi, post } }  (multi = 묶음 횟수) */
export function parseBoard(board) {
  const out = {};
  for (const row of board.children ?? []) {
    if (!UUID.test(row.name)) continue;
    const cell = (name) => row.children?.find((c) => c.name === name);
    const text = (name) => cell(name)?.children?.find((c) => c.type === 'TEXT')?.characters ?? '';
    const post = text('올린 게시물 (메모)').trim();
    out[row.name] = {
      name: text('장소'),
      single: checked(cell('단일')),
      multi: Number.parseInt(text('묶음'), 10) || 0,
      post: post === '-' ? '' : post,
    };
  }
  return out;
}

const TOKEN_DAYS = 30;
const WARN_DAYS = 5;
const RENEW = 'Figma → Settings → Security → Personal access tokens에서 File content: Read only로 새로 만들고 project/.env의 FIGMA_READ_TOKEN을 바꿔줘 (만든 날은 FIGMA_READ_TOKEN_SET_AT).';

export function notify(title, message) {
  const q = (s) => JSON.stringify(String(s));
  try {
    execFileSync('/usr/bin/osascript', ['-e', `display notification ${q(message)} with title ${q(title)} sound name "Glass"`]);
  } catch {
    // 알림을 못 보내도 아래 오류 출력과 종료 코드로 남는다
  }
}

/** 만든 날 기준 남은 날. 날짜를 모르면 null */
export function daysLeft(setAt, now = new Date()) {
  const t = Date.parse(`${setAt ?? ''}T00:00:00+09:00`);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t + TOKEN_DAYS * 86400000 - now.getTime()) / 86400000);
}

async function fetchBoard() {
  if (!TOKEN) {
    const error = new Error('FIGMA_READ_TOKEN이 없다 (project/.env 또는 admin/.env.local에 추가)');
    error.tokenProblem = true;
    throw error;
  }
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(BOARD_ID)}`, {
    headers: { 'X-Figma-Token': TOKEN },
  });
  if (res.status === 401 || res.status === 403) {
    const error = new Error(`Figma 토큰이 거부됐다 (${res.status}). 만료됐거나 권한이 없다.`);
    error.tokenProblem = true;
    throw error;
  }
  if (!res.ok) throw new Error(`figma ${res.status}`);
  const body = await res.json();
  const board = body.nodes?.[BOARD_ID]?.document;
  if (!board) throw new Error('제작 현황 보드를 찾지 못했다');
  return board;
}

async function main() {
  const args = process.argv.slice(2);
  const board = await fetchBoard();
  const rows = parseBoard(board);
  if (args.includes('--check')) {
    const left = daysLeft(env.FIGMA_READ_TOKEN_SET_AT);
    if (left !== null && left <= WARN_DAYS) {
      notify('OOMAP: Figma 토큰 곧 만료', `${Math.max(left, 0)}일 남음. ${RENEW}`);
      console.log(`토큰 정상, 만료까지 ${left}일 → 알림 보냄`);
    } else {
      console.log(`토큰 정상 (장소 ${Object.keys(rows).length}곳 읽음${left === null ? ', 만든 날 모름' : `, 만료까지 ${left}일`})`);
    }
    return;
  }
  const i = args.indexOf('--unused');
  if (i >= 0) {
    const kind = args[i + 1];
    if (!['single', 'multi'].includes(kind)) throw new Error('--unused single|multi');
    console.log(JSON.stringify(Object.keys(rows).filter((id) => !rows[id][kind]).sort((a, b) => rows[a].multi - rows[b].multi)));
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    if (error.tokenProblem) {
      notify('OOMAP: Figma 토큰 다시 만들어줘', `제작 현황을 못 읽었어. ${RENEW}`);
      process.exit(2);
    }
    process.exit(1);
  });
}
