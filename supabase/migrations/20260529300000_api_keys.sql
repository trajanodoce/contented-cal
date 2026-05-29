-- API Keys table for public CRUD API access
-- Keys are scoped per-workspace with read / read_write / full permissions

CREATE TYPE api_key_scope AS ENUM ('read', 'read_write', 'full');

CREATE TABLE api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  key_prefix   text NOT NULL,            -- e.g. "cc_sk_a8f3"
  scope        api_key_scope NOT NULL DEFAULT 'read',
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

CREATE INDEX idx_api_keys_hash      ON api_keys (key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_workspace ON api_keys (workspace_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only workspace admins can see keys
CREATE POLICY "admins_select_api_keys" ON api_keys
  FOR SELECT USING (get_workspace_role(workspace_id) = 'admin'::workspace_role);

CREATE POLICY "admins_insert_api_keys" ON api_keys
  FOR INSERT WITH CHECK (
    get_workspace_role(workspace_id) = 'admin'::workspace_role
    AND created_by = (SELECT auth.uid())
  );

CREATE POLICY "admins_update_api_keys" ON api_keys
  FOR UPDATE USING (get_workspace_role(workspace_id) = 'admin'::workspace_role);

-- Authenticate an API key: look up by hash, update last_used_at, return workspace + scope
-- SECURITY DEFINER so the edge function (service role) can call it
CREATE OR REPLACE FUNCTION authenticate_api_key(p_key_hash text)
RETURNS TABLE(workspace_id uuid, scope api_key_scope)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE api_keys ak
  SET last_used_at = now()
  WHERE ak.key_hash = p_key_hash
    AND ak.revoked_at IS NULL
  RETURNING ak.workspace_id, ak.scope
  INTO workspace_id, scope;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN NEXT;
END;
$$;
