#!/usr/bin/env node
/**
 * OOMAP Slack 봇: 알림 채널의 스레드 답장·@oomap 태그 → 이 Mac에서 Claude CLI 실행 → 같은 스레드에 답.
 *
 *   node scripts/slack-bot.mjs            # 계속 실행 (launchd com.oomap.slack-bot 이 띄운다)
 *   node scripts/slack-bot.mjs --once "질문"   # Slack 없이 Claude 호출만 시험
 *
 * 무엇에 반응하나
 *   - @oomap 태그 (스레드 밖이면 그 메시지 아래에 스레드를 연다)
 *   - 봇이 올린 글의 스레드, 또는 이미 대화 중인 스레드에 단 답장
 *   - SLACK_ALLOWED_USERS(쉼표 구분 Slack 사용자 ID)에 있는 사람 말만 듣는다. 다른 사람·봇 메시지는 무시한다.
 *
 * 스레드마다 Claude 세션 하나를 이어 쓴다 (admin/.slack-bot/state.json 에 thread_ts → session_id).
 * Claude는 auto 권한 모드로 JWMAP 폴더에서 돈다. 인스타 게시·DB 삭제는 스레드에서 분명히 말했을 때만 하도록 지시한다.
 * 토큰은 project/.env 의 SLACK_BOT_TOKEN(xoxb)·SLACK_APP_TOKEN(xapp)이고, 로그에 찍지 않는다.
 */
import { spawn } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { slackApi, slackEnv, slackPost } from './lib/slack.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const STATE_DIR = path.join(REPO, 'admin/.slack-bot');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const CLAUDE = process.env.CLAUDE_BIN || '/Users/sinjong-won/.nvm/versions/node/v22.13.1/bin/claude';
const TIMEOUT_MS = 25 * 60 * 1000;

const SYSTEM = `너는 OOMAP(쩝쩝박사 @chyubeleub_j, 오늘 오디가) 운영을 돕는 Slack 봇이다. 지금 대화는 Slack 알림 채널의 한 스레드이고, 네 최종 답은 그대로 그 스레드에 올라간다.
- 답은 한국어 해요체로, Slack에서 읽기 좋게 짧게 쓴다. 표 대신 짧은 목록을 쓴다. 굵게는 *별표 하나*다.
- 토큰·키 값은 절대 읽거나 출력하지 않는다 (project/.env).
- 인스타그램 게시(media_publish), 운영 DB 삭제·대량 수정은 사용자가 이 스레드에서 그 대상을 분명히 말해 지시했을 때만 한다. 애매하면 먼저 묻는다.
- 이미지·파일을 보여줄 때: node admin/scripts/slack-post.mjs --thread "$SLACK_THREAD_TS" --file <경로> [--file ...] "설명"
- 진행이 오래 걸리면 중간에 node admin/scripts/slack-post.mjs --thread "$SLACK_THREAD_TS" "지금 하는 일" 로 짧게 알린다.
- 프로젝트 규칙은 CLAUDE.md, docs/content-automation/CONTENT_RULES.md, 메모리를 따른다.`;

const env = slackEnv();
const ALLOWED = new Set((env.SLACK_ALLOWED_USERS || '').split(',').map((s) => s.trim()).filter(Boolean));
const CHANNEL = env.SLACK_CHANNEL_ID;

const log = (...a) => console.log(new Date().toISOString(), ...a);

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { threads: {}, seen: [] };
  }
}
const state = loadState();
function saveState() {
  mkdirSync(STATE_DIR, { recursive: true });
  state.seen = state.seen.slice(-500);
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
}

/** Claude CLI 한 번 실행 → { text, sessionId } */
export function runClaude(prompt, { sessionId, threadTs } = {}) {
  return new Promise((resolve) => {
    const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'auto', '--append-system-prompt', SYSTEM];
    if (sessionId) args.push('--resume', sessionId);
    const child = spawn(CLAUDE, args, {
      cwd: REPO,
      env: { ...process.env, SLACK_THREAD_TS: threadTs ?? '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(out);
        resolve({ text: j.result || '(빈 답)', sessionId: j.session_id, error: j.is_error });
      } catch {
        resolve({ text: `Claude 실행이 실패했어요 (종료 코드 ${code}). ${err.slice(-400)}`, sessionId, error: true });
      }
    });
  });
}

let BOT_USER = null;
const queue = [];
let busy = false;

async function threadText(ts) {
  const r = await slackApi('conversations.replies', { channel: CHANNEL, ts, limit: 50 });
  if (!r.ok) return { parentIsBot: false, text: '' };
  const msgs = r.messages ?? [];
  const parentIsBot = Boolean(msgs[0]?.bot_id) || msgs[0]?.user === BOT_USER;
  const text = msgs
    .map((m) => `${m.bot_id || m.user === BOT_USER ? '[봇]' : '[사용자]'} ${(m.text || '').replace(/<@[A-Z0-9]+>/g, '').trim()}`)
    .join('\n\n');
  return { parentIsBot, text };
}

async function handle(ev) {
  const threadTs = ev.thread_ts || ev.ts;
  const userText = (ev.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();
  await slackApi('reactions.add', { channel: ev.channel, timestamp: ev.ts, name: 'eyes' });
  const sessionId = state.threads[threadTs];
  let prompt = userText;
  if (!sessionId) {
    const { text } = await threadText(threadTs);
    prompt = `Slack 스레드 지금까지 내용:\n\n${text}\n\n위 스레드의 마지막 사용자 메시지에 답해줘.`;
  }
  log('run', threadTs, sessionId ? 'resume' : 'new');
  const res = await runClaude(prompt, { sessionId, threadTs });
  if (res.sessionId) {
    state.threads[threadTs] = res.sessionId;
    saveState();
  }
  await slackPost(res.text, { thread: threadTs, channel: ev.channel });
  await slackApi('reactions.remove', { channel: ev.channel, timestamp: ev.ts, name: 'eyes' });
  await slackApi('reactions.add', { channel: ev.channel, timestamp: ev.ts, name: res.error ? 'x' : 'white_check_mark' });
  log('done', threadTs, res.error ? 'error' : 'ok');
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const ev = queue.shift();
    try {
      await handle(ev);
    } catch (error) {
      log('handle error', error.message);
    }
  }
  busy = false;
}

async function onEvent(ev) {
  if (!ev || ev.channel !== CHANNEL) return;
  if (ev.bot_id || (ev.subtype && ev.subtype !== 'thread_broadcast')) return;
  if (!ALLOWED.has(ev.user)) return;
  const key = `${ev.channel}:${ev.ts}`;
  if (state.seen.includes(key)) return;
  const mentioned = ev.type === 'app_mention' || (BOT_USER && (ev.text || '').includes(`<@${BOT_USER}>`));
  let go = mentioned;
  if (!go && ev.type === 'message' && ev.thread_ts) {
    go = Boolean(state.threads[ev.thread_ts]) || (await threadText(ev.thread_ts)).parentIsBot;
  }
  if (!go) return;
  state.seen.push(key);
  saveState();
  queue.push(ev);
  pump();
}

async function connect() {
  const r = await slackApi('apps.connections.open', {}, env.SLACK_APP_TOKEN);
  if (!r.ok) {
    log('connections.open 실패', r.error);
    setTimeout(connect, 30000);
    return;
  }
  const ws = new WebSocket(r.url);
  ws.onopen = () => log('connected');
  ws.onmessage = (m) => {
    let msg;
    try {
      msg = JSON.parse(m.data);
    } catch {
      return;
    }
    if (msg.envelope_id) ws.send(JSON.stringify({ envelope_id: msg.envelope_id }));
    if (msg.type === 'disconnect') ws.close();
    if (msg.type === 'events_api') onEvent(msg.payload?.event).catch((e) => log('event error', e.message));
  };
  ws.onclose = () => {
    log('closed, reconnecting');
    setTimeout(connect, 3000);
  };
  ws.onerror = (e) => log('ws error', e.message ?? '');
}

async function main() {
  const i = process.argv.indexOf('--once');
  if (i >= 0) {
    const res = await runClaude(process.argv[i + 1] || '안녕? 한 줄로 답해줘.');
    console.log(res);
    return;
  }
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_APP_TOKEN || !CHANNEL) throw new Error('SLACK_BOT_TOKEN·SLACK_APP_TOKEN·SLACK_CHANNEL_ID 가 project/.env 에 필요하다');
  if (!ALLOWED.size) throw new Error('SLACK_ALLOWED_USERS 가 비어 있다 (명령을 들을 Slack 사용자 ID)');
  const auth = await slackApi('auth.test', {});
  if (!auth.ok) throw new Error(`auth.test 실패: ${auth.error}`);
  BOT_USER = auth.user_id;
  log('bot', auth.user, 'allowed', [...ALLOWED].join(','));
  await connect();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
