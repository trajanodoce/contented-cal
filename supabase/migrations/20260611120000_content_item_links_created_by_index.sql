-- Covering index for content_item_links.created_by foreign key.
--
-- Flagged by the Supabase performance advisor (lint 0001 unindexed_foreign_keys):
-- the FK content_item_links_created_by_fkey had no covering index. Negligible
-- runtime impact at current scale, but matters for the profile-delete cascade
-- (created_by REFERENCES profiles ON DELETE SET NULL) and keeps the advisor
-- board clean. The (item_a_id) / (item_b_id) lookup indexes already exist from
-- the table's creation migration; this completes FK index coverage.

CREATE INDEX IF NOT EXISTS idx_content_item_links_created_by
  ON public.content_item_links (created_by);
