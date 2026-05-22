/*
  # Phase 4: Projects, Team Permissions, and Invites

  1. New Tables
    - `workspace_invites` — pending email invites with token-based acceptance
      - id, workspace_id, email, role, token (unique), invited_by, created_at, accepted_at

  2. Modified Tables
    - `workspace_members` — expose joined_at for display; no schema change needed
    - `content_items` — project_id already exists from Phase 1

  3. Security
    - RLS on workspace_invites
    - Admins can insert/delete invites for their workspace
    - Anyone can read an invite by token (for acceptance flow)
    - Members can read invites for their workspace

  4. Indexes
    - Token lookup index on workspace_invites
    - Email lookup index on workspace_invites
*/

CREATE TABLE IF NOT EXISTS workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz
);

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invites"
  ON workspace_invites FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete invites"
  ON workspace_invites FOR DELETE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Members can view workspace invites"
  ON workspace_invites FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read invite by token"
  ON workspace_invites FOR SELECT TO anon
  USING (accepted_at IS NULL);

CREATE POLICY "Invited user can accept invite"
  ON workspace_invites FOR UPDATE TO authenticated
  USING (accepted_at IS NULL)
  WITH CHECK (accepted_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);

-- Ensure project_id index exists on content_items for project filtering
CREATE INDEX IF NOT EXISTS idx_content_items_project ON content_items(project_id);
