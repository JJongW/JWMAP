#!/usr/bin/env node
/**
 * 검토함 사진(place_photos 중 url 없는 내 사진) → 1600px로 줄여 Cloudinary에 올리고 url을 채운다.
 *
 *   node scripts/odiga-photo-upload.mjs                # 무엇을 올릴지 개수만 보여준다
 *   node scripts/odiga-photo-upload.mjs --apply        # 장소마다 6장씩 올린다
 *   node scripts/odiga-photo-upload.mjs --apply --per-place 0   # 남은 사진 전부
 *
 * 외장 드라이브가 연결된 Mac mini에서 돌린다. 원본 파일은 건드리지 않는다.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const perPlaceArg = args.indexOf('--per-place');
const PER_PLACE = perPlaceArg >= 0 ? Number(args[perPlaceArg + 1]) : 6;
const CONCURRENCY = 4;

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

const env = readEnv(path.join(REPO, 'project/.env'));
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
const CLOUD = env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = env.VITE_CLOUDINARY_UPLOAD_PRESET;
if (!SUPABASE_URL || !SERVICE_KEY || !CLOUD || !PRESET) {
  console.error('project/.env에 Supabase service 키 또는 Cloudinary 설정이 없어요');
  process.exit(1);
}
const db = (pathAndQuery, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...init.headers },
  });

/** 고르게 뽑기: 촬영 순서대로 n장을 간격을 두고 */
function spread(list, n) {
  if (!n || list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]);
}

async function upload(photo, tmp) {
  const out = path.join(tmp, `${photo.id}.jpg`);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', '1600', photo.local_path, '--out', out], {
    stdio: 'ignore',
  });
  const form = new FormData();
  form.append('file', new Blob([readFileSync(out)], { type: 'image/jpeg' }), `${photo.id}.jpg`);
  form.append('upload_preset', PRESET);
  form.append('folder', 'oomap/places');
  form.append('public_id', photo.id);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`cloudinary ${res.status} ${await res.text()}`);
  const body = await res.json();
  const patch = await db(`place_photos?id=eq.${photo.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ url: body.secure_url, width: body.width, height: body.height }),
  });
  if (!patch.ok) throw new Error(`place_photos ${patch.status} ${await patch.text()}`);
}

async function main() {
  const res = await db('place_photos?select=id,intake_id,place_id,local_path,taken_at&source=eq.own&url=is.null&local_path=not.is.null&order=taken_at.asc.nullslast&limit=10000');
  if (!res.ok) throw new Error(`place_photos ${res.status} ${await res.text()}`);
  const pending = await res.json();
  const groups = new Map();
  for (const photo of pending) {
    const key = photo.intake_id ?? photo.place_id;
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  }
  const chosen = [...groups.values()].flatMap((list) => spread(list, PER_PLACE));
  const missing = chosen.filter((p) => !existsSync(p.local_path));
  console.log(JSON.stringify({ waiting: pending.length, places: groups.size, to_upload: chosen.length, missing_files: missing.length }));
  if (!APPLY) return;

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'oomap-photos-'));
  const queue = chosen.filter((p) => existsSync(p.local_path));
  let done = 0;
  let failed = 0;
  try {
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let photo = queue.shift(); photo; photo = queue.shift()) {
          try {
            await upload(photo, tmp);
            done += 1;
          } catch (error) {
            failed += 1;
            console.error(`실패 ${photo.local_path}: ${error.message}`);
          }
          if ((done + failed) % 25 === 0) console.log(`${done + failed}/${chosen.length - missing.length}`);
        }
      }),
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ uploaded: done, failed }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
