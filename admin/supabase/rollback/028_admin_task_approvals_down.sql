-- 028 되돌리기: 세 테이블을 다시 service role 전용으로, 승인 함수 삭제
DROP FUNCTION IF EXISTS public.admin_decide_task(uuid, boolean, text);
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_tasks', 'task_approvals', 'execution_logs'] LOOP
    CONTINUE WHEN to_regclass(format('public.%I', t)) IS NULL;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_read', t);
  END LOOP;
END $$;
