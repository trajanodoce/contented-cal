-- Fix: restore the full logic of insert_alerts_for_mentions().
--
-- Migration 20260604120000_security_sweep_rpc_revokes.sql rewrote this
-- trigger to add `SET search_path = ''`, but in the process it replaced
-- the original body with a much simpler version that used non-existent
-- columns (`comment_id`, `triggered_by`) and dropped several pieces of
-- the original logic. Result: every comment with an @mention threw
--   "column \"comment_id\" of relation \"user_alerts\" does not exist"
-- which surfaced in the UI as a toast and silently broke the mention
-- alert pipeline.
--
-- This migration restores the full original behavior from
-- 20260602220000_phase6_mentions_backend.sql, while keeping the
-- `SET search_path = ''` hardening + fully qualified table names that
-- the security sweep was trying to introduce.
--
-- Restored behavior:
--   * INSERT vs UPDATE diff — only alert on newly-added mentions
--   * Skip alerts for soft-deleted comments
--   * Skip self-mentions
--   * Skip mentions where the recipient has muted the parent project
--   * 60s coalescing — no duplicate alert for the same comment within 60s

CREATE OR REPLACE FUNCTION public.insert_alerts_for_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mentioned_user uuid;
  new_mentions uuid[];
  target_workspace_id uuid;
  target_project_id uuid;
  recent_count int;
BEGIN
  -- For INSERT, all mentions are new. For UPDATE, only newly-added mentions.
  IF TG_OP = 'INSERT' THEN
    new_mentions := COALESCE(NEW.mentions, '{}'::uuid[]);
  ELSE
    SELECT ARRAY(
      SELECT DISTINCT unnest(COALESCE(NEW.mentions, '{}'::uuid[]))
      EXCEPT
      SELECT DISTINCT unnest(COALESCE(OLD.mentions, '{}'::uuid[]))
    ) INTO new_mentions;
  END IF;

  -- Nothing to do if no new mentions
  IF array_length(new_mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip alerts for tombstoned comments (soft-delete safety)
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve workspace + project from the parent content_item
  SELECT ci.workspace_id, ci.project_id
    INTO target_workspace_id, target_project_id
  FROM public.content_items ci
  WHERE ci.id = NEW.content_item_id;

  IF target_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH mentioned_user IN ARRAY new_mentions LOOP
    -- Skip self-mentions
    CONTINUE WHEN mentioned_user = NEW.user_id;

    -- Skip if user has muted this project
    IF target_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = target_workspace_id
        AND wm.user_id = mentioned_user
        AND target_project_id = ANY(COALESCE(wm.muted_projects, '{}'::uuid[]))
    ) THEN
      CONTINUE;
    END IF;

    -- 60s coalescing: skip if there's a recent alert for this user/source
    SELECT COUNT(*) INTO recent_count
    FROM public.user_alerts
    WHERE user_id = mentioned_user
      AND alert_type = 'mention'
      AND source_id = NEW.id
      AND created_at > NOW() - INTERVAL '60 seconds';

    IF recent_count = 0 THEN
      INSERT INTO public.user_alerts (
        workspace_id, user_id, alert_type, source_id, source_type,
        content_item_id, actor_id
      )
      VALUES (
        target_workspace_id, mentioned_user, 'mention', NEW.id, 'comment',
        NEW.content_item_id, NEW.user_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
