-- Fix two remaining security advisor WARNs.

-- 1. cleanup_slack_processed_events: earlier REVOKE missed PUBLIC
REVOKE EXECUTE ON FUNCTION public.cleanup_slack_processed_events() FROM PUBLIC;

-- 2. soft_delete_comment: revoke anon access (authenticated users need it)
REVOKE EXECUTE ON FUNCTION public.soft_delete_comment(uuid) FROM PUBLIC, anon;
