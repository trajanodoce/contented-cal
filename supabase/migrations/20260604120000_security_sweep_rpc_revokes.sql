-- Security sweep — RPC access revokes from 2026-06-04 deep review.
--
-- 1. authenticate_api_key: anon-callable → service_role only
-- 2. insert_alerts_for_mentions: anon-callable trigger fn → revoke direct RPC
-- 3. insert_alerts_for_subtask_assignment: same
-- 4. insert_alerts_for_mentions: fix search_path convention

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. authenticate_api_key — restrict to service role
-- ═══════════════════════════════════════════════════════════════════════════════
-- Callable by anon via public RPC, enabling unauthenticated hash probing.
-- Only called from the api edge function (service role).

REVOKE EXECUTE ON FUNCTION public.authenticate_api_key(text) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2+3. Trigger functions — revoke direct RPC access
-- ═══════════════════════════════════════════════════════════════════════════════
-- These are AFTER INSERT triggers on comments/subtasks. They should never be
-- called directly via RPC — they fire automatically from trigger context.

REVOKE EXECUTE ON FUNCTION public.insert_alerts_for_mentions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_alerts_for_subtask_assignment() FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Fix search_path on insert_alerts_for_mentions
-- ═══════════════════════════════════════════════════════════════════════════════
-- Align to project convention: SET search_path = '' with fully qualified names.

CREATE OR REPLACE FUNCTION public.insert_alerts_for_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mention_id uuid;
BEGIN
  -- Only process comments that have mentions
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert an alert for each mentioned user (skip self-mentions)
  FOREACH mention_id IN ARRAY NEW.mentions
  LOOP
    IF mention_id <> NEW.user_id THEN
      INSERT INTO public.user_alerts (user_id, workspace_id, alert_type, content_item_id, comment_id, triggered_by)
      SELECT
        mention_id,
        ci.workspace_id,
        'mention',
        NEW.content_item_id,
        NEW.id,
        NEW.user_id
      FROM public.content_items ci
      WHERE ci.id = NEW.content_item_id
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
