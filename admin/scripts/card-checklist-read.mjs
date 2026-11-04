#!/usr/bin/env node
/**
 * Figma 「제작 현황」 페이지의 체크를 읽는다 → 장소별로 단일/묶음 카드뉴스를 만들었는지.
 *
 *   FIGMA_TOKEN=... node scripts/card-checklist-read.mjs            # JSON 출력
 *   node scripts/card-checklist-read.mjs --unused single            # 단일 게시물을 아직 안 만든 place_id만
 *   node scripts/card-checklist-read.mjs --unused multi             # 묶음에 아직 안 들어간 place_id만
 *
 * 목록 구조 (Figma 파일 oTmjexkwnDyPutL1qYJqrU, 보드 27:27 「카드뉴스 제작 현황」):
 *   줄 이름 = place_id, 칸 「단일」·「묶음」 안에 Check 컴포넌트(boolean 속성 checked), 칸 「올린 게시물 (메모)」의 글자 = 메모.
 * 토큰은 project/.env 또는 admin/.env.local 의 FIGMA_TOKEN (Figma 개인 토큰, file_content:read). 출력에 토큰을 찍지 않는다.
 */
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
const TOKEN = env.FIGMA_TOKEN;

const checked = (cell) => {
  const inst = cell?.children?.find((c) => c.type === 'INSTANCE');
  const prop = inst && Object.entries(inst.componentProperties ?? {}).find(([k]) => k.startsWith('checked'));
  return Boolean(prop && prop[1].value);
};

/** 보드 JSON(Figma REST 노드 문서) → { place_id: { name, single, multi, post } } */
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
      multi: checked(cell('묶음')),
      post: post === '-' ? '' : post,
    };
  }
  return out;
}

async function main() {
  if (!TOKEN) throw new Error('FIGMA_TOKEN이 없다 (project/.env 또는 admin/.env.local에 추가)');
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(BOARD_ID)}`, {
    headers: { 'X-Figma-Token': TOKEN },
  });
  if (!res.ok) throw new Error(`figma ${res.status}`);
  const body = await res.json();
  const board = body.nodes?.[BOARD_ID]?.document;
  if (!board) throw new Error('제작 현황 보드를 찾지 못했다');
  const rows = parseBoard(board);
  const args = process.argv.slice(2);
  const i = args.indexOf('--unused');
  if (i >= 0) {
    const kind = args[i + 1];
    if (!['single', 'multi'].includes(kind)) throw new Error('--unused single|multi');
    console.log(JSON.stringify(Object.keys(rows).filter((id) => !rows[id][kind])));
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
