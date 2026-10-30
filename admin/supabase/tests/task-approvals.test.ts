/**
 * 028 admin "승인 대기"에서 Oomap MCP 작업 승인·거절 (개발 DB: PGlite)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  MIGRATION_020,
  MIGRATION_028,
  PROD_RLS_STATE,
  ROLLBACK_028,
  applyCurationMigrations,
  count,
  createBaseDb,
} from '../dev/curationDb';

const ADMIN = '00000000-0000-0000-0000-00000000ad01';
const OTHER = '00000000-0000-0000-0000-00000000ad02';
let db: PGlite;

const one = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows[0];

async function as<T>(role: 'anon' | 'authenticated', uid: string, run: () => Promise<T>) {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${uid}', false); SET ROLE ${role}`);
  try {
    return await run();
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false)`);
  }
}

const task = (command: string, status = 'proposed') =>
  one<{ id: string }>(`INSERT INTO agent_tasks (title, requested_by, assigned_agent, command, command_params, status)
    VALUES ('검토함 2곳 결정', 'claude-mcp', 'data', '${command}', '{"items": []}', '${status}') RETURNING id`);

const decide = (uid: string, id: string, approve: boolean, comment = 'NULL') =>
  as('authenticated', uid, async () => (await one<{ s: string }>(`SELECT admin_decide_task('${id}', ${approve}, ${comment}) AS s`)).s);

beforeAll(async () => {
  db = await createBaseDb();
  await db.exec(PROD_RLS_STATE);
  // 운영과 같은 모양 (jmw-auto-engine 004_control_plane.sql)
  await db.exec(`
    DROP TABLE agent_tasks, task_approvals, execution_logs;
    CREATE TABLE agent_tasks (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, title text NOT NULL, description text,
      requested_by text NOT NULL, assigned_agent text NOT NULL, command text, command_params jsonb,
      status text NOT NULL DEFAULT 'proposed', result text, error text,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
      CONSTRAINT agent_tasks_status_check CHECK (status IN ('proposed', 'debating', 'approved', 'executing', 'done', 'failed')));
    CREATE TABLE task_approvals (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, task_id uuid NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
      approved_by text NOT NULL, status text NOT NULL DEFAULT 'pending', comment text, created_at timestamptz DEFAULT now(),
      UNIQUE (task_id), CONSTRAINT task_approvals_status_check CHECK (status IN ('pending', 'approved', 'rejected')));
    CREATE TABLE execution_logs (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, task_id uuid NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
      command text NOT NULL, params jsonb, started_at timestamptz DEFAULT now(), finished_at timestamptz,
      success boolean, output text, error text);
    INSERT INTO auth.users (id, email) VALUES ('${ADMIN}', 'operator@example.com');
  `);
  await applyCurationMigrations(db);
  await db.exec(MIGRATION_020);
  // 020 이후 가입한 계정은 admin이 아니다
  await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${OTHER}', 'someone@example.com')`);
  await db.exec(MIGRATION_028);
});

afterAll(async () => {
  await db.close();
});

describe('028', () => {
  it('admin은 작업과 실행 기록을 읽고, 다른 계정과 anon은 못 읽는다', async () => {
    const { id } = await task('oomap:intake_decide');
    await db.exec(`INSERT INTO execution_logs (task_id, command) VALUES ('${id}', 'oomap:intake_decide')`);
    const read = (role: 'anon' | 'authenticated', uid: string) =>
      as(role, uid, async () => ({
        tasks: await count(db, `SELECT count(*) FROM agent_tasks`),
        logs: await count(db, `SELECT count(*) FROM execution_logs`),
      }));
    expect(await read('authenticated', ADMIN)).toEqual({ tasks: 1, logs: 1 });
    expect(await read('authenticated', OTHER)).toEqual({ tasks: 0, logs: 0 });
    expect(await read('anon', '')).toEqual({ tasks: 0, logs: 0 });
  });

  it('admin도 표를 직접 바꾸지는 못한다', async () => {
    const { id } = await task('oomap:places_hide');
    await as('authenticated', ADMIN, () => db.exec(`UPDATE agent_tasks SET status = 'approved' WHERE id = '${id}'`).catch(() => null));
    expect((await one<{ status: string }>(`SELECT status FROM agent_tasks WHERE id = '${id}'`)).status).toBe('proposed');
  });

  it('승인하면 approved, 승인 기록이 남는다', async () => {
    const { id } = await task('oomap:intake_decide');
    expect(await decide(ADMIN, id, true)).toBe('approved');
    expect((await one<{ status: string }>(`SELECT status FROM agent_tasks WHERE id = '${id}'`)).status).toBe('approved');
    const a = await one<{ status: string; approved_by: string }>(`SELECT status, approved_by FROM task_approvals WHERE task_id = '${id}'`);
    expect(a).toEqual({ status: 'approved', approved_by: `admin:${ADMIN}` });
  });

  it('거절하면 failed, 사유가 남는다', async () => {
    const { id } = await task('oomap:recommendation_save');
    expect(await decide(ADMIN, id, false, `'문장이 과장됨'`)).toBe('failed');
    const a = await one<{ status: string; comment: string }>(`SELECT status, comment FROM task_approvals WHERE task_id = '${id}'`);
    expect(a).toEqual({ status: 'rejected', comment: '문장이 과장됨' });
  });

  it('이미 정한 작업, Oomap이 아닌 작업, admin이 아닌 계정은 막는다', async () => {
    const done = await task('oomap:script', 'approved');
    await expect(decide(ADMIN, done.id, true)).rejects.toThrow(/이미 approved/);
    const other = await task('job:content');
    await expect(decide(ADMIN, other.id, true)).rejects.toThrow(/Oomap 작업만/);
    const p = await task('oomap:script');
    await expect(decide(OTHER, p.id, true)).rejects.toThrow(/관리자만/);
    await expect(as('anon', '', () => db.query(`SELECT admin_decide_task('${p.id}', true)`))).rejects.toThrow();
    expect((await one<{ status: string }>(`SELECT status FROM agent_tasks WHERE id = '${p.id}'`)).status).toBe('proposed');
  });

  it('되돌리면 다시 service role 전용', async () => {
    await db.exec(ROLLBACK_028);
    expect(await as('authenticated', ADMIN, () => count(db, `SELECT count(*) FROM agent_tasks`))).toBe(0);
    expect(await count(db, `SELECT count(*) FROM pg_proc WHERE proname = 'admin_decide_task'`)).toBe(0);
  });
});
