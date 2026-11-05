/**
 * OOMAP Slack 알림 공통 모듈. 토큰은 project/.env 의 SLACK_BOT_TOKEN·SLACK_CHANNEL_ID 에서 읽고, 출력에 찍지 않는다.
 *
 *   import { slackPost, slackUpload } from './lib/slack.mjs';
 *   const ts = await slackPost('카드뉴스 검수 요청 ...');               // 채널에 새 글
 *   await slackPost('답장', { thread: ts });                           // 스레드 답장
 *   await slackUpload(['/path/01.png', '/path/02.png'], { thread: ts, comment: '카드 5장' });
 *
 * 토큰이 없거나 Slack이 실패해도 예외를 던지지 않고 null을 돌려준다 (알림 때문에 본 작업이 멈추지 않게).
 */
import { readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');

export function readEnv(file) {
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

export const slackEnv = () => ({ ...readEnv(path.join(REPO, 'project/.env')), ...process.env });

export async function slackApi(method, body, token = slackEnv().SLACK_BOT_TOKEN) {
  if (!token) return { ok: false, error: 'no_token' };
  try {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/** Slack 한 메시지 최대 길이를 넘으면 나눈다 */
export function splitText(text, size = 3500) {
  const out = [];
  let rest = String(text);
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size / 2) cut = size;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest.trim()) out.push(rest);
  return out;
}

/** 채널(또는 스레드)에 글을 쓴다. 성공하면 첫 메시지 ts, 실패하면 null */
export async function slackPost(text, { thread, channel } = {}) {
  const env = slackEnv();
  const ch = channel || env.SLACK_CHANNEL_ID;
  let first = null;
  for (const part of splitText(text)) {
    const r = await slackApi('chat.postMessage', { channel: ch, text: part, thread_ts: thread || undefined, unfurl_links: false });
    if (!r.ok) {
      console.error(`[slack] chat.postMessage 실패: ${r.error}`);
      return first;
    }
    first ??= r.ts;
  }
  return first;
}

/** 파일 여러 개를 한 메시지로 올린다 (files.getUploadURLExternal → completeUploadExternal) */
export async function slackUpload(files, { thread, channel, comment } = {}) {
  const env = slackEnv();
  const token = env.SLACK_BOT_TOKEN;
  if (!token) return false;
  const uploaded = [];
  for (const file of files) {
    const name = path.basename(file);
    const length = statSync(file).size;
    const q = new URLSearchParams({ filename: name, length: String(length) });
    const r = await fetch(`https://slack.com/api/files.getUploadURLExternal?${q}`, { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.json());
    if (!r.ok) {
      console.error(`[slack] 업로드 주소 실패: ${r.error}`);
      return false;
    }
    const put = await fetch(r.upload_url, { method: 'POST', body: readFileSync(file) });
    if (!put.ok) {
      console.error(`[slack] 업로드 실패: ${put.status}`);
      return false;
    }
    uploaded.push({ id: r.file_id, title: name });
  }
  const done = await slackApi('files.completeUploadExternal', {
    files: uploaded,
    channel_id: channel || env.SLACK_CHANNEL_ID,
    thread_ts: thread || undefined,
    initial_comment: comment || undefined,
  });
  if (!done.ok) console.error(`[slack] 업로드 마무리 실패: ${done.error}`);
  return Boolean(done.ok);
}
