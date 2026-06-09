-- Security hardening: standardize search_path on remaining SECURITY DEFINER
-- functions and add missing UPDATE policy on project_members.
--
-- From the 2026-06-08 eval session security review, items #5 and #6.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Harden search_path on 5 SECURITY DEFINER functions
--    (changing from search_path=public to search_path='' to prevent
--    schema-shadowing attacks — matches the hardened pattern already
--    used on accept_invite, cleanup_slack_processed_events,
--    get_workspace_stats, insert_alerts_for_mentions, seed_workspace_defaults)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER FUNCTION public.authenticate_api_key(text) SET search_path = '';
ALTER FUNCTION public.get_workspace_role(uuid) SET search_path = '';
ALTER FUNCTION public.is_workspace_member(uuid) SET search_path = '';
ALTER FUNCTION public.soft_delete_comment(uuid) SET search_path = '';
ALTER FUNCTION public.insert_alerts_for_subtask_assignment() SET search_path = '';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Add missing UPDATE policy on project_members
--    (table has SELECT, INSERT, DELETE but no UPDATE — inconsistent with
--    the other tables' policy sets)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Editors and admins can update project members"
  ON public.project_members
  FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = (SELECT auth.uid())
          AND wm.role IN ('admin'::public.workspace_role, 'editor'::public.workspace_role)
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = (SELECT auth.uid())
          AND wm.role IN ('admin'::public.workspace_role, 'editor'::public.workspace_role)
      )
    )
  );
