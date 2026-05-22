/*
  # Phase 5: External Links

  1. New Tables
    - `external_links`
      - `id` (uuid, primary key)
      - `content_item_id` (uuid, FK → content_items.id, cascade delete)
      - `platform` (text, enum-like: ordinal, figma, canva, miro, google_docs, google_drive, notion, linear, other)
      - `url` (text, not null)
      - `title` (text)
      - `thumbnail_url` (text)
      - `metadata` (jsonb) — arbitrary fetched data (og:description, etc.)
      - `created_by` (uuid)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `external_links`
    - SELECT: workspace members can read links for items in their workspace
    - INSERT: authenticated workspace members can add links
    - DELETE: link creator or admins can delete

  3. Indexes
    - Index on content_item_id for fast lookups
    - Index on platform for the "has links from [platform]" filter
*/

CREATE TABLE IF NOT EXISTS external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'other',
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  thumbnail_url text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE external_links ENABLE ROW LEVEL SECURITY;

-- Members of the workspace that owns the content item can view its links
CREATE POLICY "Workspace members can view external links"
  ON external_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM content_items ci
      JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = external_links.content_item_id
        AND wm.user_id = auth.uid()
    )
  );

-- Workspace members can insert external links
CREATE POLICY "Workspace members can add external links"
  ON external_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM content_items ci
      JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = external_links.content_item_id
        AND wm.user_id = auth.uid()
    )
  );

-- Creator or admin can delete links
CREATE POLICY "Creator or admin can delete external links"
  ON external_links FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM content_items ci
      JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = external_links.content_item_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS external_links_content_item_id_idx ON external_links(content_item_id);
CREATE INDEX IF NOT EXISTS external_links_platform_idx ON external_links(platform);
