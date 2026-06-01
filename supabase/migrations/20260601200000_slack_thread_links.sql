-- Slack thread links table — structured conversation artifacts linked to content items.
-- Parallel to granola_note_links. Source of truth for the Slack threads section in the detail panel.

CREATE TABLE slack_thread_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id   uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  slack_channel_id  text NOT NULL,
  slack_thread_ts   text NOT NULL,
  permalink         text NOT NULL,
  channel_name      text,
  parent_message    text,
  parent_author_id  text,
  parent_author_name text,
  requester_id      text,           -- Slack user ID who triggered the @mention (NULL for manually linked)
  requester_name    text,
  participant_count integer,
  captured_at       timestamptz NOT NULL DEFAULT now(),
  thread_start_at   timestamptz,    -- When the parent message was posted
  is_origin         boolean NOT NULL DEFAULT false,  -- TRUE for auto-linked originating thread (drives banner)
  raw_thread_snapshot jsonb,        -- Full message list captured at link-time
  added_by          uuid REFERENCES profiles(id),    -- ContentedCal user who manually linked (NULL for auto)
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- One thread per item (prevent dupes)
CREATE UNIQUE INDEX uq_slack_thread_links_per_item
  ON slack_thread_links (content_item_id, slack_channel_id, slack_thread_ts);

-- Fast lookup: "is this thread already linked anywhere?"
CREATE INDEX idx_slack_thread_links_content_item
  ON slack_thread_links (content_item_id);

CREATE INDEX idx_slack_thread_links_thread
  ON slack_thread_links (slack_channel_id, slack_thread_ts);

ALTER TABLE slack_thread_links ENABLE ROW LEVEL SECURITY;

-- RLS: workspace membership via content_items FK
CREATE POLICY "members_select_slack_thread_links" ON slack_thread_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = content_item_id
        AND is_workspace_member(ci.workspace_id)
    )
  );

CREATE POLICY "members_insert_slack_thread_links" ON slack_thread_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = content_item_id
        AND is_workspace_member(ci.workspace_id)
    )
  );

CREATE POLICY "members_delete_slack_thread_links" ON slack_thread_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = content_item_id
        AND is_workspace_member(ci.workspace_id)
    )
  );

-- Backfill: migrate existing Slack-origin items from custom_fields to slack_thread_links
INSERT INTO slack_thread_links (content_item_id, slack_channel_id, slack_thread_ts, permalink, requester_id, requester_name, is_origin)
SELECT
  ci.id,
  ci.custom_fields->>'_slack_channel',
  COALESCE(ci.custom_fields->>'_slack_thread_ts', ci.custom_fields->>'_slack_ts', ''),
  COALESCE(ci.custom_fields->>'_slack_permalink', ''),
  ci.custom_fields->>'_slack_user',
  ci.custom_fields->>'_slack_user_name',
  true
FROM content_items ci
WHERE ci.custom_fields->>'_source' = 'slack'
  AND ci.custom_fields->>'_slack_channel' IS NOT NULL
ON CONFLICT (content_item_id, slack_channel_id, slack_thread_ts) DO NOTHING;
