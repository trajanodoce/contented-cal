/*
  # Ordinal Social Integration

  1. New Tables
    - `ordinal_post_links` - Links content items to Ordinal social posts
      - `id` (uuid, primary key)
      - `content_item_id` (uuid, references content_items)
      - `workspace_id` (uuid, references workspaces)
      - `ordinal_post_id` (text, Ordinal's internal post ID)
      - `platform` (text - LinkedIn, X, Instagram, TikTok)
      - `post_url` (text, link to edit in Ordinal)
      - `post_body` (text, the actual post copy)
      - `status` (text - ToDo, Scheduled, Posted)
      - `scheduled_at` (timestamptz)
      - `published_at` (timestamptz)
      - `metrics` (jsonb - engagement stats)
      - `synced_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on ordinal_post_links
    - Policies for workspace members to read their data

  3. Functions
    - `get_ordinal_sync_status(workspace_id)` - Returns sync stats
*/

-- Create ordinal_post_links table
CREATE TABLE IF NOT EXISTS ordinal_post_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ordinal_post_id text,
  platform text NOT NULL DEFAULT 'LinkedIn',
  post_url text,
  post_body text,
  status text NOT NULL DEFAULT 'ToDo',
  scheduled_at timestamptz,
  published_at timestamptz,
  metrics jsonb DEFAULT '{}',
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ordinal_post_links_content_item_id ON ordinal_post_links(content_item_id);
CREATE INDEX IF NOT EXISTS idx_ordinal_post_links_workspace_id ON ordinal_post_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ordinal_post_links_platform ON ordinal_post_links(platform);
CREATE INDEX IF NOT EXISTS idx_ordinal_post_links_status ON ordinal_post_links(status);

-- Enable Row Level Security
ALTER TABLE ordinal_post_links ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view ordinal_post_links for items in their workspace
CREATE POLICY "Users can view workspace ordinal links"
  ON ordinal_post_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ordinal_post_links.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Function to get Ordinal sync status for a workspace
CREATE OR REPLACE FUNCTION get_ordinal_sync_status(p_workspace_id uuid)
RETURNS TABLE (
  total_posts bigint,
  linkedin_count bigint,
  x_count bigint,
  instagram_count bigint,
  tiktok_count bigint,
  last_sync_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_posts,
    COUNT(*) FILTER (WHERE platform = 'LinkedIn')::bigint as linkedin_count,
    COUNT(*) FILTER (WHERE platform = 'X')::bigint as x_count,
    COUNT(*) FILTER (WHERE platform = 'Instagram')::bigint as instagram_count,
    COUNT(*) FILTER (WHERE platform = 'TikTok')::bigint as tiktok_count,
    MAX(synced_at) as last_sync_at
  FROM ordinal_post_links
  WHERE workspace_id = p_workspace_id;
END;
$$;
