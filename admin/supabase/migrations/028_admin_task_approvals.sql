-- ============================================================
-- 028: admin "승인 대기"에서 Oomap MCP 작업을 보고 승인·거절한다
--
-- MCP의 *_plan 도구는 agent_tasks(proposed)를 만들고, 승인된 작업만 task_run이 실행한다.
-- 020에서 agent_tasks·task_approvals·execution_logs는 service role 전용으로 막았다.
--   - admin은 세 테이블을 읽기만 한다 (쓰기 정책은 두지 않는다)
--   - 승인·거절은 admin_decide_task 하나로만 한다. Oomap 작업(command = 'oomap:*')이고
--     아직 proposed인 것만 바꾼다. 기록 방식은 엔진의 approvalGate.approve/reject와 같다
--     (task_approvals upsert, agent_tasks.status = approved / failed)
-- 실행은 여기서 하지 않는다. Mac mini의 Claude Code가 task_run으로 한다.
-- 되돌리기: rollback/028_admin_task_approvals_down.sql
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_tasks', 'task_approvals', 'execution_logs'] LOOP
    CONTINUE WHEN to_regclass(format('public.%I', t)) IS NULL;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT private.is_admin()))',
                   t || '_admin_read', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_decide_task(
  p_task_id uuid,
  p_approve boolean,
  p_comment text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t public.agent_tasks%ROWTYPE;
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION '관리자만 승인할 수 있어요';
  END IF;
  SELECT * INTO t FROM public.agent_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '작업이 없어요: %', p_task_id; END IF;
  IF t.command IS NULL OR t.command NOT LIKE 'oomap:%' THEN
    RAISE EXCEPTION 'Oomap 작업만 여기서 승인할 수 있어요';
  END IF;
  IF t.status <> 'proposed' THEN
    RAISE EXCEPTION '이미 % 상태라 다시 정할 수 없어요', t.status;
  END IF;

  INSERT INTO public.task_approvals (task_id, approved_by, status, comment)
  VALUES (p_task_id, 'admin:' || (SELECT auth.uid())::text,
          CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, nullif(btrim(p_comment), ''))
  ON CONFLICT (task_id) DO UPDATE
    SET approved_by = EXCLUDED.approved_by, status = EXCLUDED.status, comment = EXCLUDED.comment;

  UPDATE public.agent_tasks
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'failed' END
  WHERE id = p_task_id;

  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'failed' END;
END $$;

REVOKE ALL ON FUNCTION public.admin_decide_task(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_task(uuid, boolean, text) TO authenticated;
