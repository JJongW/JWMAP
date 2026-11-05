#!/usr/bin/env node
/**
 * 카드뉴스 폴더 → 인스타 캐러셀 게시 (사용자가 그 게시물을 올리라고 했을 때만 쓴다)
 *
 *   node scripts/ig-publish.mjs <카드 폴더> [--thread SLACK_TS] [--dry-run]
 *
 * 폴더에는 01.png, 02.png ... (최대 10장, API 한도)와 caption.txt 가 있어야 한다.
 * PNG → JPEG(sips) → Cloudinary 서명 업로드(oomap/posts/<폴더 이름>/NN) → 캐러셀 아이템 → CAROUSEL → media_publish.
 * 같은 폴더를 두 번 올리지 않도록 게시 후 폴더에 published.json 을 남기고, 있으면 멈춘다.
 * 결과(링크 또는 오류)는 --thread 가 있으면 그 Slack 스레드에 올린다.
 * 토큰(INSTAGRAM_TOKEN, CLOUDINARY_URL)은 project/.env 에서 읽고 출력하지 않는다.
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { slackEnv, slackPost } from './lib/slack.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = args.includes('--dry-run');
const THREAD = flag('--thread');
const DIR = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--thread') ?? '');
const GRAPH = 'https://graph.facebook.com/v23.0';
const env = slackEnv();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function graph(pathname, params = {}, method = 'POST') {
  const body = new URLSearchParams({ ...params, access_token: env.INSTAGRAM_TOKEN });
  const url = method === 'GET' ? `${GRAPH}/${pathname}?${body}` : `${GRAPH}/${pathname}`;
  const res = await fetch(url, method === 'GET' ? {} : { method, body });
  const j = await res.json();
  if (j.error) throw new Error(`graph ${pathname}: ${j.error.message}`);
  return j;
}

async function waitReady(id) {
  for (let i = 0; i < 30; i++) {
    const { status_code } = await graph(id, { fields: 'status_code' }, 'GET');
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`컨테이너 ${id} 상태 ${status_code}`);
    await sleep(3000);
  }
  throw new Error(`컨테이너 ${id} 준비 시간 초과`);
}

async function cloudinaryUpload(file, publicId) {
  const m = /cloudinary:\/\/([^:]+):([^@]+)@(.+)/.exec(env.CLOUDINARY_URL ?? '');
  if (!m) throw new Error('CLOUDINARY_URL 이 없다');
  const [, key, secret, cloud] = m;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHash('sha1').update(`overwrite=true&public_id=${publicId}&timestamp=${timestamp}${secret}`).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([readFileSync(file)], { type: 'image/jpeg' }), path.basename(file));
  for (const [k, v] of Object.entries({ api_key: key, timestamp, public_id: publicId, overwrite: 'true', signature })) form.append(k, v);
  const j = await (await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form })).json();
  if (!j.secure_url) throw new Error(`Cloudinary 업로드 실패: ${j.error?.message ?? 'unknown'}`);
  return j.secure_url;
}

async function main() {
  if (!existsSync(DIR)) throw new Error(`폴더가 없다: ${DIR}`);
  const done = path.join(DIR, 'published.json');
  if (existsSync(done)) throw new Error(`이미 게시한 폴더다: ${JSON.parse(readFileSync(done, 'utf8')).permalink}`);
  const cards = readdirSync(DIR).filter((f) => /^\d+\.png$/.test(f)).sort();
  if (!cards.length || cards.length > 10) throw new Error(`카드는 1~10장이어야 한다 (지금 ${cards.length}장)`);
  const caption = readFileSync(path.join(DIR, 'caption.txt'), 'utf8').trim();
  if (!env.INSTAGRAM_TOKEN || !env.INSTAGRAM_USER_ID) throw new Error('INSTAGRAM_TOKEN·INSTAGRAM_USER_ID 가 project/.env 에 필요하다');
  log('카드', cards.length, '장, 캡션', caption.length, '자');
  if (DRY) return { dry: true };

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'ig-'));
  const urls = [];
  for (const f of cards) {
    const jpg = path.join(tmp, f.replace('.png', '.jpg'));
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', path.join(DIR, f), '--out', jpg], { stdio: 'ignore' });
    urls.push(await cloudinaryUpload(jpg, `oomap/posts/${path.basename(DIR)}/${f.replace('.png', '')}`));
  }
  log('Cloudinary', urls.length, '장');

  const children = [];
  for (const image_url of urls) {
    const { id } = await graph(`${env.INSTAGRAM_USER_ID}/media`, { image_url, is_carousel_item: 'true' });
    children.push(id);
  }
  for (const id of children) await waitReady(id);
  const params = cards.length === 1 ? { image_url: urls[0], caption } : { media_type: 'CAROUSEL', children: children.join(','), caption };
  const { id: container } = await graph(`${env.INSTAGRAM_USER_ID}/media`, params);
  await waitReady(container);
  const { id: mediaId } = await graph(`${env.INSTAGRAM_USER_ID}/media_publish`, { creation_id: container });
  const { permalink } = await graph(mediaId, { fields: 'permalink' }, 'GET');
  writeFileSync(done, JSON.stringify({ media_id: mediaId, permalink, published_at: new Date().toISOString() }, null, 1));
  log('게시됨', permalink);
  return { permalink };
}

main()
  .then(async (r) => {
    if (THREAD && r.permalink) await slackPost(`*게시했어요* ${r.permalink}\n제작 현황 체크와 Figma 섹션 상태는 이 스레드에서 말해 주면 갱신할게요.`, { thread: THREAD });
  })
  .catch(async (error) => {
    console.error(error.message);
    if (THREAD) await slackPost(`*인스타 게시 실패*: ${error.message}`, { thread: THREAD });
    process.exit(1);
  });
