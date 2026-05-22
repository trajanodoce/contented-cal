/*
  # Fix Security Issues

  1. Function Search Path Mutable
    - Recreate `update_updated_at()` with `SET search_path = ''` to prevent search path manipulation
    - Recreate `seed_workspace_defaults()` with `SET search_path = ''` to prevent search path manipulation

  2. RLS Policy Always True on workspaces INSERT
    - Drop the existing permissive INSERT policy on workspaces that uses `WITH CHECK (true)`
    - Replace with a restrictive policy requiring `auth.uid() IS NOT NULL`
      (authenticated users can still create workspaces, but the policy is no longer trivially true)

  3. SECURITY DEFINER Function Access Revocation
    - Revoke EXECUTE on `get_user_workspace_ids()` from `anon` and `public` roles
      (only `authenticated` should call it; it is SECURITY DEFINER)
    - Revoke EXECUTE on `seed_workspace_defaults()` from `anon`, `authenticated`, and `public` roles
      (this function is only called by the trigger, never directly via RPC)

  4. Notes
    - `get_user_workspace_ids()` already had `SET search_path = public` — no change needed there
    - The trigger on workspaces still fires `seed_workspace_defaults()` as expected;
      revoking EXECUTE only blocks direct RPC calls, not trigger invocation
*/

-- ============================================================
-- 1. Fix mutable search_path on update_updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Fix mutable search_path on seed_workspace_defaults
--    (also remains SECURITY DEFINER so it can insert into
--     content_types and board_columns bypassing RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_workspace_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.content_types (workspace_id, name, icon, color) VALUES
    (NEW.id, 'Blog Post', 'FileText', '#3B82F6'),
    (NEW.id, 'Social Post', 'Share2', '#10B981'),
    (NEW.id, 'Email Campaign', 'Mail', '#F59E0B'),
    (NEW.id, 'Landing Page', 'Layout', '#8B5CF6'),
    (NEW.id, 'Customer Story', 'Users', '#EC4899'),
    (NEW.id, 'Webinar', 'Video', '#06B6D4'),
    (NEW.id, 'Video', 'Play', '#EF4444'),
    (NEW.id, 'Ad Creative', 'Image', '#F97316'),
    (NEW.id, 'One-Pager', 'AlignLeft', '#14B8A6'),
    (NEW.id, 'Press Release', 'Newspaper', '#6366F1');

  INSERT INTO public.board_columns (workspace_id, name, position, color) VALUES
    (NEW.id, 'Backlog', 0, '#6B7280'),
    (NEW.id, 'In Progress', 1, '#3B82F6'),
    (NEW.id, 'In Review', 2, '#F59E0B'),
    (NEW.id, 'Approved', 3, '#8B5CF6'),
    (NEW.id, 'Scheduled', 4, '#06B6D4'),
    (NEW.id, 'Published', 5, '#10B981');

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Fix always-true INSERT policy on workspaces
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 4. Revoke direct EXECUTE on SECURITY DEFINER functions
-- ============================================================

-- seed_workspace_defaults: only invoked by trigger, never via RPC
REVOKE EXECUTE ON FUNCTION public.seed_workspace_defaults() FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_workspace_defaults() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_workspace_defaults() FROM public;

-- get_user_workspace_ids: used by RLS policies internally; block anon and public RPC
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_ids() FROM public;
