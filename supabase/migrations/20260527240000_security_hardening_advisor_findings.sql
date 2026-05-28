-- Security hardening from Supabase advisor findings.
--
-- 1. Set explicit search_path on functions that lacked it. Without an
--    explicit search_path, a function lookup can be steered by the caller's
--    search_path — a minor escalation vector, especially in functions
--    invoked across schemas.
--
-- 2. workspace_invites_update had WITH CHECK (true), so any authenticated
--    user with USING access could mutate any field — including
--    workspace_id, email, or role on a pending invite. Mirror USING in
--    WITH CHECK so the post-update row must still pass the original
--    access predicate. Closes:
--      * "I admin workspace A → move an invite to workspace B"
--      * "I'm invited as alice@... → change the email to point at someone
--         else's account"
--    Note: this still permits an invitee to edit non-key fields (e.g.,
--    role) on their own pending invite before acceptance. A stronger fix
--    would funnel acceptance through a SECURITY DEFINER function with
--    column-level enforcement.

-- 1. Function search_path hardening
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_content_items_fts() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_slack_status_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.search_content_items(ws_id uuid, search_query text) SET search_path = public, pg_temp;
ALTER FUNCTION public.duplicate_content_item(item_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.upsert_granola_note(
  p_workspace_id uuid,
  p_granola_note_id text,
  p_title text,
  p_summary_text text,
  p_summary_markdown text,
  p_meeting_start timestamp with time zone,
  p_meeting_end timestamp with time zone,
  p_attendees jsonb,
  p_web_url text,
  p_folder_name text
) SET search_path = public, pg_temp;
ALTER FUNCTION public.upsert_granola_note(
  p_workspace_id uuid,
  p_granola_note_id text,
  p_title text,
  p_summary_text text,
  p_summary_markdown text,
  p_meeting_start timestamp with time zone,
  p_meeting_end timestamp with time zone,
  p_attendees jsonb,
  p_web_url text,
  p_folder_name text,
  p_owner_id uuid
) SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_archive_meeting_notes() SET search_path = public, pg_temp;

-- 2. workspace_invites_update: mirror USING in WITH CHECK
ALTER POLICY workspace_invites_update ON public.workspace_invites
  WITH CHECK (
    (email = ((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))::text)
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin'::public.workspace_role, 'editor'::public.workspace_role)
    )
  );
