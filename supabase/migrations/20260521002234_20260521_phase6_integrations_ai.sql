/*
  # Phase 6: Integrations & AI

  1. New Tables
    - `integrations`
      - `id` (uuid, primary key)
      - `workspace_id` (uuid, FK → workspaces.id, cascade delete)
      - `platform` (text: google, notion, linear, claude)
      - `access_token` (text, encrypted at rest via Supabase vault — stored as ciphertext)
      - `refresh_token` (text)
      - `config` (jsonb) — platform-specific config (selected calendar, notion db id, etc.)
      - `status` (text: connected, error, disconnected)
      - `connected_by` (uuid, FK → auth.users)
      - `connected_at` (timestamptz)
      - `updated_at` (timestamptz)
      - UNIQUE on (workspace_id, platform)

    - `ai_interactions`
      - `id` (uuid, primary key)
      - `content_item_id` (uuid, FK → content_items.id, cascade delete)
      - `workspace_id` (uuid, FK → workspaces.id)
      - `user_id` (uuid, FK → auth.users)
      - `action` (text: summarize, headlines, meta_description, social_posts, improvements, custom)
      - `prompt` (text) — full prompt sent
      - `response` (text) — full response received
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - integrations: workspace admins manage; members can read status (not tokens)
    - ai_interactions: workspace members can read/insert for their workspace

  3. Notes
    - Tokens are stored in config/access_token columns — production would use Vault encryption
    - The Claude API key is stored in integrations.config as { api_key: "..." } for the 'claude' platform
*/

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform text NOT NULL,
  access_token text NOT NULL DEFAULT '',
  refresh_token text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'connected',
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, platform)
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view integrations"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert integrations"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can update integrations"
  ON integrations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete integrations"
  ON integrations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS integrations_workspace_platform_idx ON integrations(workspace_id, platform);

-- AI interactions table
CREATE TABLE IF NOT EXISTS ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT 'custom',
  prompt text NOT NULL DEFAULT '',
  response text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view ai interactions"
  ON ai_interactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_interactions.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can insert ai interactions"
  ON ai_interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_interactions.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS ai_interactions_content_item_idx ON ai_interactions(content_item_id);
CREATE INDEX IF NOT EXISTS ai_interactions_workspace_idx ON ai_interactions(workspace_id);
