-- ============================================================================
-- Phase 6.1: Mentions backend (lean v1)
-- ============================================================================
-- Schema for in-app comment @mentions + subtask-assignment alerts.
-- Lean v1: NO Slack DM routing (deferred to v2).
--
-- Adds:
--   - comments.mentions uuid[]      -- @mentioned user IDs
--   - comments.updated_at           -- for "(edited)" label (6.2)
--   - comments.deleted_at           -- soft-delete tombstone (6.2)
--   - comments.deleted_by           -- soft-delete attribution (6.2)
--   - workspace_members.muted_projects uuid[]  -- mute per-project alerts
--   - user_alerts                   -- in-app alert feed table
--
-- Triggers:
--   - comments_mentions_alerts      -- fires alerts on insert/update of mentions[]
--   - subtasks_assignment_alerts    -- fires alerts when assignee_id changes
--   - comments_set_updated_at       -- maintains updated_at on UPDATE
--
-- Functions:
--   - soft_delete_comment(uuid)     -- SECURITY DEFINER soft-delete for 6.2
--                                       (author OR workspace admin)
-- ============================================================================

-- 1. Extend comments ---------------------------------------------------------
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comments_mentions ON comments USING GIN (mentions);
CREATE INDEX IF NOT EXISTS idx_comments_active ON comments (content_item_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN comments.mentions IS
  'Phase 6.1: uuid[] of profile.id users mentioned in this comment via @mention chips. Drives user_alerts trigger.';
COMMENT ON COLUMN comments.updated_at IS
  'Phase 6.2: maintained by trigger on UPDATE. Drives "(edited)" label in UI.';
COMMENT ON COLUMN comments.deleted_at IS
  'Phase 6.2: soft-delete timestamp. NULL = active; non-NULL = tombstone (UI renders "Comment deleted").';
COMMENT ON COLUMN comments.deleted_by IS
  'Phase 6.2: who soft-deleted this comment (for tombstone attribution).';

-- 2. Extend workspace_members -----------------------------------------------
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS muted_projects uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN workspace_members.muted_projects IS
  'Phase 6.1: project IDs the user has muted. @mention alerts for items in these projects are suppressed.';

-- 3. user_alerts table -------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('mention', 'subtask_assigned')),
  source_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('comment', 'subtask')),
  content_item_id uuid NULL REFERENCES content_items(id) ON DELETE CASCADE,
  actor_id uuid NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL,
  CONSTRAINT user_alerts_source_consistent CHECK (
    (alert_type = 'mention' AND source_type = 'comment')
    OR (alert_type = 'subtask_assigned' AND source_type = 'subtask')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_alerts_user_unread
  ON user_alerts (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_alerts_user_feed
  ON user_alerts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_alerts_source
  ON user_alerts (source_id, source_type);

CREATE INDEX IF NOT EXISTS idx_user_alerts_workspace
  ON user_alerts (workspace_id);

COMMENT ON TABLE user_alerts IS
  'Phase 6.1: in-app alert feed. Lean v1 supports mention + subtask_assigned types. '
  'Inserted exclusively by SECURITY DEFINER triggers on comments/subtasks. '
  'RLS restricts SELECT/UPDATE/DELETE to user_id = auth.uid().';

-- RLS ------------------------------------------------------------------------
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

-- Users see only their own alerts
DROP POLICY IF EXISTS "Users see own alerts" ON user_alerts;
CREATE POLICY "Users see own alerts"
  ON user_alerts FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Users can mark their own alerts as read (UPDATE)
DROP POLICY IF EXISTS "Users update own alerts" ON user_alerts;
CREATE POLICY "Users update own alerts"
  ON user_alerts FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can delete (clear) their own alerts
DROP POLICY IF EXISTS "Users delete own alerts" ON user_alerts;
CREATE POLICY "Users delete own alerts"
  ON user_alerts FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- No INSERT policy: alerts are created exclusively by SECURITY DEFINER triggers.

-- 4. Trigger fn: insert alerts on comment @mentions -------------------------
CREATE OR REPLACE FUNCTION public.insert_alerts_for_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  FROM content_items ci
  WHERE ci.id = NEW.content_item_id;

  IF target_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH mentioned_user IN ARRAY new_mentions LOOP
    -- Skip self-mentions
    CONTINUE WHEN mentioned_user = NEW.user_id;

    -- Skip if user has muted this project
    IF target_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = target_workspace_id
        AND wm.user_id = mentioned_user
        AND target_project_id = ANY(COALESCE(wm.muted_projects, '{}'::uuid[]))
    ) THEN
      CONTINUE;
    END IF;

    -- 60s coalescing: skip if there's a recent alert for this user/source
    SELECT COUNT(*) INTO recent_count
    FROM user_alerts
    WHERE user_id = mentioned_user
      AND alert_type = 'mention'
      AND source_id = NEW.id
      AND created_at > NOW() - INTERVAL '60 seconds';

    IF recent_count = 0 THEN
      INSERT INTO user_alerts (
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

DROP TRIGGER IF EXISTS comments_mentions_alerts ON comments;
CREATE TRIGGER comments_mentions_alerts
AFTER INSERT OR UPDATE OF mentions ON comments
FOR EACH ROW
EXECUTE FUNCTION public.insert_alerts_for_mentions();

-- 5. Trigger fn: insert alerts on subtask assignment ------------------------
CREATE OR REPLACE FUNCTION public.insert_alerts_for_subtask_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_workspace_id uuid;
  current_user_id uuid;
BEGIN
  -- Skip if no assignee
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip on UPDATE if assignee didn't change
  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
    RETURN NEW;
  END IF;

  -- Resolve workspace from content_item
  SELECT ci.workspace_id INTO target_workspace_id
  FROM content_items ci
  WHERE ci.id = NEW.content_item_id;

  IF target_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  current_user_id := (SELECT auth.uid());

  -- Skip self-assignment
  IF NEW.assignee_id = current_user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO user_alerts (
    workspace_id, user_id, alert_type, source_id, source_type,
    content_item_id, actor_id
  )
  VALUES (
    target_workspace_id, NEW.assignee_id, 'subtask_assigned', NEW.id, 'subtask',
    NEW.content_item_id, current_user_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subtasks_assignment_alerts ON subtasks;
CREATE TRIGGER subtasks_assignment_alerts
AFTER INSERT OR UPDATE OF assignee_id ON subtasks
FOR EACH ROW
EXECUTE FUNCTION public.insert_alerts_for_subtask_assignment();

-- 6. Trigger fn: maintain comments.updated_at ------------------------------
CREATE OR REPLACE FUNCTION public.set_comments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_set_updated_at ON comments;
CREATE TRIGGER comments_set_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION public.set_comments_updated_at();

-- 7. Soft-delete RPC for 6.2 -------------------------------------------------
-- Allows author OR workspace admin to soft-delete a comment. Uses SECURITY
-- DEFINER so callers don't need broad UPDATE permission on comments.
CREATE OR REPLACE FUNCTION public.soft_delete_comment(comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authorized boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM comments c
    JOIN content_items ci ON ci.id = c.content_item_id
    WHERE c.id = comment_id
      AND (
        c.user_id = (SELECT auth.uid())
        OR get_workspace_role(ci.workspace_id) = 'admin'::workspace_role
      )
  ) INTO authorized;

  IF NOT authorized THEN
    RAISE EXCEPTION 'Permission denied: not author or workspace admin';
  END IF;

  UPDATE comments
  SET deleted_at = NOW(),
      deleted_by = (SELECT auth.uid())
  WHERE id = comment_id
    AND deleted_at IS NULL; -- idempotent
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_comment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_comment(uuid) TO authenticated;

COMMENT ON FUNCTION public.soft_delete_comment(uuid) IS
  'Phase 6.2: soft-delete a comment (sets deleted_at + deleted_by). Author or workspace admin only.';
