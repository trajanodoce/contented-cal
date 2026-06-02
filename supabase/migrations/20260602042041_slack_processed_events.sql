-- Idempotency table for Slack event delivery.
--
-- Slack retries event_callback deliveries when the receiver takes >3s to
-- respond OR returns 5xx, within a ~5 minute window. Same event_id on
-- every retry. Without this table, retries hit the comment branch (or the
-- /my-tasks branch, or the project: branch) and produce duplicate work.
--
-- The edge function inserts into this table at the top of the event
-- handler. A UNIQUE PK conflict is the signal that this event was already
-- processed — return 200 silently.

CREATE TABLE slack_processed_events (
  event_id     text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- For periodic cleanup queries
CREATE INDEX idx_slack_processed_events_processed_at
  ON slack_processed_events(processed_at);

-- Service-role-only table. The edge function uses the service-role key
-- which bypasses RLS; no user-facing access is ever needed. Enable RLS
-- with no policies — denies all non-service-role access by default.
ALTER TABLE slack_processed_events ENABLE ROW LEVEL SECURITY;

-- Cleanup helper. Slack retries within ~5min, so anything older than
-- 24 hours is safely droppable. Run periodically (manually or via cron)
-- to keep the table small.
CREATE OR REPLACE FUNCTION cleanup_slack_processed_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM slack_processed_events WHERE processed_at < now() - INTERVAL '24 hours';
$$;
