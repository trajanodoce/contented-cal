/*
  # Ordinal Social Integration Update

  1. New Tables
    - `ordinal_user_connections` - Per-user Ordinal connections
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `workspace_id` (uuid, references workspaces)
      - `profile_id` (text, Ordinal profile ID)
      - `profile_name` (text)
      - `platform` (text)
      - `connected_at` (timestamptz)
      - `last_sync_at` (timestamptz)

  2. Security
    - Enable RLS on ordinal_user_connections
    - Policies for users to manage their own connections
*/

-- Create ordinal_user_connections table for per-user connections
CREATE TABLE IF NOT EXISTS ordinal_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_id text NOT NULL,
  profile_name text,
  platform text NOT NULL DEFAULT 'LinkedIn',
  connected_at timestamptz DEFAULT now(),
  last_sync_at timestamptz DEFAULT now(),
  UNIQUE(user_id, workspace_id, profile_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ordinal_user_connections_user_id ON ordinal_user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_ordinal_user_connections_workspace_id ON ordinal_user_connections(workspace_id);

-- Enable Row Level Security
ALTER TABLE ordinal_user_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own ordinal_user_connections
CREATE POLICY "Users can manage their own ordinal connections"
  ON ordinal_user_connections
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Update get_ordinal_sync_status function to have immutable search_path
DROP FUNCTION IF EXISTS get_ordinal_sync_status(uuid);

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
SET search_path = public
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
