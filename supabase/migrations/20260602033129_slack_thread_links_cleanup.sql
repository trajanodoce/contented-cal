-- Repair the slack_thread_links backfill from the previous migration
-- (20260601200000_slack_thread_links.sql) and add a CHECK constraint to
-- prevent future empty-value rows from blocking legitimate inserts.
--
-- The earlier backfill used COALESCE(..., '') so items with no recorded
-- permalink or thread_ts got rows with empty strings. The UNIQUE constraint
-- on (content_item_id, slack_channel_id, slack_thread_ts) then claims the
-- "empty thread_ts" slot, blocking any real future link for that item.

-- Repair rows where thread_ts is valid but permalink is empty —
-- Slack permalinks follow a deterministic format we can reconstruct.
UPDATE slack_thread_links
SET permalink = 'https://slack.com/archives/' || slack_channel_id ||
                '/p' || REPLACE(slack_thread_ts, '.', '')
WHERE permalink = '' AND slack_thread_ts <> '';

-- Delete any remaining rows where thread_ts itself is empty —
-- those are unrepairable (no timestamp to reconstruct from).
DELETE FROM slack_thread_links WHERE slack_thread_ts = '';

-- Block future empty values from being inserted.
ALTER TABLE slack_thread_links
  ADD CONSTRAINT slack_thread_links_non_empty
  CHECK (slack_thread_ts <> '' AND permalink <> '');
