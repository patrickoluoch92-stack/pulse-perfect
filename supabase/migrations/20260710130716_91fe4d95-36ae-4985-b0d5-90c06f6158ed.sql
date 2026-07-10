DROP POLICY IF EXISTS planner_sessions_admin_read ON public.planner_sessions;

DROP POLICY IF EXISTS planner_sessions_owner_all ON public.planner_sessions;

CREATE POLICY planner_sessions_owner_select
ON public.planner_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY planner_sessions_owner_insert
ON public.planner_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY planner_sessions_owner_update
ON public.planner_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY planner_sessions_owner_delete
ON public.planner_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);