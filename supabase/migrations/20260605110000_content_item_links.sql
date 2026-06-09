-- Linked Tasks — peer-to-peer relationships between content items.
--
-- Locked 2026-06-05 in the workshop. Replaces "parent/child task" idea with
-- flat task linking — two tasks can be related, no hierarchy, no nested
-- sub-comments. Storage is a single row in canonical (a < b) order so the
-- (a, b) pair is unique regardless of which side initiated the link.
--
-- v1 ships ONE generic "Related" relationship. v2 may add relationship
-- types (blocks · variant-of · derived-from) via a `relation_type` enum
-- column. Schema is forward-compatible — just add a column with default.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. content_item_links table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.content_item_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_a_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  item_b_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Canonical ordering — enforces that (a, b) is stored as the
  -- alphabetically-smaller UUID first. Means each pair has exactly one row
  -- and queries don't need a UNION.
  CONSTRAINT content_item_links_ordered CHECK (item_a_id < item_b_id),
  CONSTRAINT content_item_links_pair_unique UNIQUE (item_a_id, item_b_id)
);

-- Fast lookup from either side of the pair
CREATE INDEX IF NOT EXISTS idx_content_item_links_a ON public.content_item_links (item_a_id);
CREATE INDEX IF NOT EXISTS idx_content_item_links_b ON public.content_item_links (item_b_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RLS policies
-- ═══════════════════════════════════════════════════════════════════════════
-- Membership is enforced via the parent content_items rows — a user can
-- see/manage a link if they're a workspace member of the workspace that
-- contains item_a (which equals the workspace of item_b since both tasks
-- must be in the same workspace).

ALTER TABLE public.content_item_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_item_links_select ON public.content_item_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.content_items ci
      JOIN public.workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = content_item_links.item_a_id
        AND wm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY content_item_links_insert ON public.content_item_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.content_items ci
      JOIN public.workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = content_item_links.item_a_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role IN ('admin'::public.workspace_role, 'editor'::public.workspace_role)
    )
  );

CREATE POLICY content_item_links_delete ON public.content_item_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.content_items ci
      JOIN public.workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = content_item_links.item_a_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role IN ('admin'::public.workspace_role, 'editor'::public.workspace_role)
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. link_tasks(a, b) — SECURITY DEFINER helper
-- ═══════════════════════════════════════════════════════════════════════════
-- Normalizes the (a, b) pair into canonical order before inserting. Verifies
-- both tasks live in the same workspace + the caller has admin/editor
-- access. Returns the link id (or NULL if the link already existed).

CREATE OR REPLACE FUNCTION public.link_tasks(p_task_a uuid, p_task_b uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_workspace_a uuid;
  v_workspace_b uuid;
  v_caller_role public.workspace_role;
  v_link_id uuid;
BEGIN
  IF p_task_a IS NULL OR p_task_b IS NULL THEN
    RAISE EXCEPTION 'Both task IDs are required';
  END IF;

  IF p_task_a = p_task_b THEN
    RAISE EXCEPTION 'Cannot link a task to itself';
  END IF;

  -- Resolve workspaces for both tasks
  SELECT workspace_id INTO v_workspace_a FROM public.content_items WHERE id = p_task_a;
  SELECT workspace_id INTO v_workspace_b FROM public.content_items WHERE id = p_task_b;

  IF v_workspace_a IS NULL THEN
    RAISE EXCEPTION 'Task A not found';
  END IF;
  IF v_workspace_b IS NULL THEN
    RAISE EXCEPTION 'Task B not found';
  END IF;

  IF v_workspace_a <> v_workspace_b THEN
    RAISE EXCEPTION 'Tasks must be in the same workspace';
  END IF;

  -- Verify caller is admin or editor of that workspace
  SELECT role INTO v_caller_role
  FROM public.workspace_members
  WHERE workspace_id = v_workspace_a
    AND user_id = (SELECT auth.uid());

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin'::public.workspace_role, 'editor'::public.workspace_role) THEN
    RAISE EXCEPTION 'Not authorized to link tasks in this workspace';
  END IF;

  -- Canonical ordering: smaller UUID first
  IF p_task_a < p_task_b THEN
    v_a := p_task_a;
    v_b := p_task_b;
  ELSE
    v_a := p_task_b;
    v_b := p_task_a;
  END IF;

  INSERT INTO public.content_item_links (item_a_id, item_b_id, created_by)
  VALUES (v_a, v_b, (SELECT auth.uid()))
  ON CONFLICT (item_a_id, item_b_id) DO NOTHING
  RETURNING id INTO v_link_id;

  RETURN v_link_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_tasks(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_tasks(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. unlink_tasks(a, b) — SECURITY DEFINER helper
-- ═══════════════════════════════════════════════════════════════════════════
-- Symmetric to link_tasks. Normalizes the pair, verifies workspace access,
-- removes the link if it exists. Also reverts any auto-managed
-- "Request design" subtask on the content-side task (the non-design one).

CREATE OR REPLACE FUNCTION public.unlink_tasks(p_task_a uuid, p_task_b uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_workspace_a uuid;
  v_caller_role public.workspace_role;
  v_deleted_count int;
  v_content_task_id uuid;
  v_design_task_id uuid;
BEGIN
  IF p_task_a IS NULL OR p_task_b IS NULL THEN
    RAISE EXCEPTION 'Both task IDs are required';
  END IF;

  IF p_task_a = p_task_b THEN
    RAISE EXCEPTION 'Cannot unlink a task from itself';
  END IF;

  -- Resolve workspace + verify caller role
  SELECT workspace_id INTO v_workspace_a FROM public.content_items WHERE id = p_task_a;
  IF v_workspace_a IS NULL THEN
    RAISE EXCEPTION 'Task A not found';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.workspace_members
  WHERE workspace_id = v_workspace_a
    AND user_id = (SELECT auth.uid());

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin'::public.workspace_role, 'editor'::public.workspace_role) THEN
    RAISE EXCEPTION 'Not authorized to unlink tasks in this workspace';
  END IF;

  -- Canonical ordering
  IF p_task_a < p_task_b THEN
    v_a := p_task_a;
    v_b := p_task_b;
  ELSE
    v_a := p_task_b;
    v_b := p_task_a;
  END IF;

  DELETE FROM public.content_item_links
  WHERE item_a_id = v_a AND item_b_id = v_b;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Auto-managed "Request design" subtask reversion. Identify which side of
  -- the pair was the content task (category = 'content') and which was the
  -- design task (category = 'design'). If we find a content+design pair,
  -- uncheck any "Request design" subtask on the content task. Title match
  -- is case-insensitive but exact — won't accidentally uncheck "request
  -- hero image" or other subtasks. Subtasks that were auto-created (no
  -- manual edits beyond title) stay in the list but uncheck — user can
  -- still see they once had a linked design task.
  SELECT
    (SELECT id FROM public.content_items WHERE id IN (p_task_a, p_task_b) AND category = 'content' LIMIT 1),
    (SELECT id FROM public.content_items WHERE id IN (p_task_a, p_task_b) AND category = 'design' LIMIT 1)
  INTO v_content_task_id, v_design_task_id;

  IF v_content_task_id IS NOT NULL AND v_design_task_id IS NOT NULL THEN
    UPDATE public.subtasks
    SET completed = false,
        updated_at = NOW()
    WHERE content_item_id = v_content_task_id
      AND LOWER(title) = 'request design'
      AND completed = true;
  END IF;

  RETURN v_deleted_count > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unlink_tasks(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_tasks(uuid, uuid) TO authenticated;
