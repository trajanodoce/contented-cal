-- Secure workspace invite acceptance flow.
--
-- Closes a privilege-escalation hole flagged in the 2026-06-04 security
-- review: the existing workspace_invites_update policy allowed an
-- invitee to update their own pending invite row (because their email
-- matched), but didn't gate which *columns* could be touched. Between
-- sign-up and the frontend's auto-accept step, an invitee could:
--
--     await supabase.from('workspace_invites')
--       .update({ role: 'admin' }).eq('id', myInviteId);
--
-- and flip their pending row from `viewer` → `admin`. The auto-accept
-- block in WorkspaceContext then read the tampered role and granted
-- admin in workspace_members.
--
-- Threat model is low for the current internal team (attacker would
-- need to be (a) already invited, (b) technical enough to forge a
-- Supabase call, (c) acting in bad faith). High for any future
-- public/SaaS use. Fixing now while the surface area is small.
--
-- Fix:
--   (1) `accept_invite(p_invite_id uuid)` SECURITY DEFINER function.
--       Re-reads the invite row inside the function (ignoring anything
--       the caller may have written), verifies the invite's email
--       matches the caller's auth.users.email, inserts the membership
--       with the role AS STORED, then marks accepted_at.
--   (2) Tightens workspace_invites_update policy — drops the email-
--       matches clause so invitees can't touch their own row at all.
--       Admins/editors retain UPDATE rights for normal management
--       (cancel an invite, change role pre-acceptance, etc.).
--
-- After this migration, the frontend's auto-accept block becomes a
-- single `supabase.rpc('accept_invite', { p_invite_id })` call —
-- the function is the only path that can write to accepted_at.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. accept_invite — SECURITY DEFINER function
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.accept_invite(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite_workspace_id uuid;
  v_invite_email text;
  v_invite_role public.workspace_role;
  v_caller_email text;
BEGIN
  -- Re-read the invite row inside the function. Critically, we read by
  -- ID only — we don't trust anything the caller may have just written
  -- to the row. workspace_id and role are pulled fresh from the DB.
  SELECT workspace_id, email, role
    INTO v_invite_workspace_id, v_invite_email, v_invite_role
  FROM public.workspace_invites
  WHERE id = p_invite_id
    AND accepted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or already accepted';
  END IF;

  -- Verify the invite's email matches the calling user's email. Without
  -- this check, any authenticated user could call accept_invite() with
  -- any invite ID they happen to learn.
  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = (SELECT auth.uid());

  IF v_caller_email IS NULL OR LOWER(v_caller_email) <> LOWER(v_invite_email) THEN
    RAISE EXCEPTION 'Invite email does not match caller';
  END IF;

  -- Create the membership using the role AS STORED in the invite. Even
  -- if the caller tampered with the row beforehand, those changes are
  -- ignored because we re-read above.
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_invite_workspace_id, (SELECT auth.uid()), v_invite_role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Mark the invite accepted. This is the ONLY path that writes
  -- accepted_at after the policy tightening below.
  UPDATE public.workspace_invites
  SET accepted_at = NOW()
  WHERE id = p_invite_id;

  RETURN v_invite_workspace_id;
END;
$$;

-- Lock down execution: only authenticated users can call this, never
-- anon or PUBLIC. (The function still checks email match internally.)
REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Tighten workspace_invites_update: drop the email-match clause
-- ═══════════════════════════════════════════════════════════════════════════
-- Before: UPDATE allowed if (email matches caller) OR (caller is admin/editor)
-- After:  UPDATE allowed ONLY if caller is admin/editor of the workspace.
--
-- Invitees no longer have any direct write access to workspace_invites.
-- Their only path to update accepted_at is via accept_invite() above.

ALTER POLICY workspace_invites_update ON public.workspace_invites
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role IN ('admin'::public.workspace_role, 'editor'::public.workspace_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role IN ('admin'::public.workspace_role, 'editor'::public.workspace_role)
    )
  );
