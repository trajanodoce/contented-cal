-- Code review hardening — fixes from 2026-06-02 eval session review.
--
-- 1. get_workspace_stats: restore membership guard dropped by the archived-filter rewrite
-- 2. cleanup_slack_processed_events: restrict to service role + fix search_path convention
-- 3. slack_thread_links: fix UNIQUE constraint for race-guard correctness + add UPDATE RLS

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. get_workspace_stats — restore membership guard + keep archived filter
-- ═══════════════════════════════════════════════════════════════════════════════
-- The 20260601100000 rewrite added `archived = false` filtering but accidentally
-- dropped the workspace membership check from 20260527250000. Without it, any
-- authenticated user can enumerate another workspace's stats via RPC.

CREATE OR REPLACE FUNCTION public.get_workspace_stats(ws_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result json;
BEGIN
  -- Membership guard: return NULL for non-members (same as 20260527250000)
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  ) THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'total_items', (SELECT count(*) FROM public.content_items WHERE workspace_id = ws_id AND archived = false),
    'overdue_items', (
      SELECT count(*) FROM public.content_items ci
      WHERE ci.workspace_id = ws_id
        AND ci.archived = false
        AND ci.due_date < CURRENT_DATE
        AND ci.status NOT IN (
          SELECT id FROM public.board_columns
          WHERE workspace_id = ws_id AND (name = 'Published' OR name = 'Completed')
        )
    ),
    'items_by_status', (
      SELECT json_agg(row_data ORDER BY row_data->>'position')
      FROM (
        SELECT json_build_object(
          'status_id', bc.id, 'status_name', bc.name, 'color', bc.color,
          'count', coalesce(ci.cnt, 0), 'position', bc.position
        ) as row_data
        FROM public.board_columns bc
        LEFT JOIN (SELECT status, count(*) as cnt FROM public.content_items WHERE workspace_id = ws_id AND archived = false GROUP BY status) ci ON ci.status = bc.id
        WHERE bc.workspace_id = ws_id
      ) sub
    ),
    'items_by_type', (
      SELECT json_agg(json_build_object('type_id', ct.id, 'type_name', ct.name, 'color', ct.color, 'count', coalesce(ci.cnt, 0)))
      FROM public.content_types ct
      LEFT JOIN (SELECT content_type_id, count(*) as cnt FROM public.content_items WHERE workspace_id = ws_id AND archived = false GROUP BY content_type_id) ci ON ci.content_type_id = ct.id
      WHERE ct.workspace_id = ws_id
    ),
    'items_by_priority', (
      SELECT json_agg(json_build_object('priority', p.priority, 'count', coalesce(ci.cnt, 0)))
      FROM (VALUES ('low'::public.priority_level), ('medium'), ('high'), ('urgent')) AS p(priority)
      LEFT JOIN (SELECT priority, count(*) as cnt FROM public.content_items WHERE workspace_id = ws_id AND archived = false GROUP BY priority) ci ON ci.priority = p.priority
    ),
    'upcoming_due', (
      SELECT json_agg(json_build_object('id', id, 'title', title, 'due_date', due_date, 'priority', priority) ORDER BY due_date)
      FROM (SELECT id, title, due_date, priority FROM public.content_items WHERE workspace_id = ws_id AND archived = false AND due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + interval '7 days' ORDER BY due_date LIMIT 10) sub
    ),
    'recent_activity', (
      SELECT json_agg(json_build_object('id', al.id, 'action', al.action, 'user_name', p.full_name, 'created_at', al.created_at) ORDER BY al.created_at DESC)
      FROM (SELECT * FROM public.activity_log WHERE content_item_id IN (SELECT id FROM public.content_items WHERE workspace_id = ws_id AND archived = false) ORDER BY created_at DESC LIMIT 15) al
      LEFT JOIN public.profiles p ON p.id = al.user_id
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. cleanup_slack_processed_events — restrict + fix search_path
-- ═══════════════════════════════════════════════════════════════════════════════
-- The function was callable by any role (including anon). Restrict to service
-- role only, and align search_path to project convention (empty, not 'public').

CREATE OR REPLACE FUNCTION public.cleanup_slack_processed_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only service-role callers should run cleanup. Regular users have no
  -- business touching the idempotency table.
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'cleanup_slack_processed_events: service role required';
  END IF;

  DELETE FROM public.slack_processed_events
  WHERE processed_at < now() - INTERVAL '24 hours';
END;
$$;

-- Belt-and-suspenders: also revoke execute from non-service roles
REVOKE EXECUTE ON FUNCTION public.cleanup_slack_processed_events() FROM authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. slack_thread_links — fix UNIQUE constraint + add UPDATE policy
-- ═══════════════════════════════════════════════════════════════════════════════
-- The race guard in the Slack edge function relies on a UNIQUE constraint to
-- detect duplicate thread links. The current constraint is on
-- (content_item_id, slack_channel_id, slack_thread_ts) — but two racing
-- requests create different content_item_ids, so neither insert conflicts.
--
-- Fix: add a UNIQUE constraint on (slack_channel_id, slack_thread_ts) alone,
-- which is the actual dedup key. Keep the original as a secondary safeguard.

-- Deduplicate any existing rows first (keep the earliest per thread)
DELETE FROM public.slack_thread_links a
USING public.slack_thread_links b
WHERE a.slack_channel_id = b.slack_channel_id
  AND a.slack_thread_ts = b.slack_thread_ts
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX uq_slack_thread_links_per_thread
  ON public.slack_thread_links (slack_channel_id, slack_thread_ts);

-- Add UPDATE policy (SELECT/INSERT/DELETE existed, UPDATE was missing)
CREATE POLICY "members_update_slack_thread_links" ON public.slack_thread_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = content_item_id
        AND public.is_workspace_member(ci.workspace_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = content_item_id
        AND public.is_workspace_member(ci.workspace_id)
    )
  );
