#!/usr/bin/env node
/**
 * OOMAP Slack 채널에 글·파일을 올린다 (엔진, 스크립트, Slack 봇의 Claude가 같이 쓴다).
 *
 *   node scripts/slack-post.mjs "보낼 글"                       # 채널에 새 글, ts를 출력
 *   node scripts/slack-post.mjs --thread 1793843935.906479 "답장"
 *   node scripts/slack-post.mjs --thread $SLACK_THREAD_TS --file a.png --file b.png "카드 2장"
 *   echo "긴 글" | node scripts/slack-post.mjs -               # 표준입력에서 읽기
 *
 * Slack 봇이 실행한 Claude 안에서는 SLACK_THREAD_TS 가 지금 대화 스레드다.
 */
import { readFileSync } from 'fs';
import { slackPost, slackUpload } from './lib/slack.mjs';

const args = process.argv.slice(2);
let thread = null;
const files = [];
const words = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--thread') thread = args[++i];
  else if (args[i] === '--file') files.push(args[++i]);
  else words.push(args[i]);
}
let text = words.join(' ');
if (text === '-') text = readFileSync(0, 'utf8');

if (files.length) {
  const ok = await slackUpload(files, { thread, comment: text || undefined });
  console.log(ok ? `uploaded ${files.length}` : 'upload failed');
  process.exit(ok ? 0 : 1);
}
if (!text.trim()) {
  console.error('보낼 글이 없다');
  process.exit(2);
}
const ts = await slackPost(text, { thread });
console.log(ts ?? 'post failed');
process.exit(ts ? 0 : 1);
