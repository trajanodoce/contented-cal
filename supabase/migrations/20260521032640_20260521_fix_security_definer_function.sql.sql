/*
  # Fix SECURITY DEFINER function security issues

  1. Security Issues Fixed
    - Function was executable by `anon` role (PUBLIC)
    - Function needs strict access control for authenticated users only

  2. Changes
    - Revoke execute from PUBLIC (blocks anon access)
    - Grant execute to authenticated role only
    - Keep SECURITY DEFINER with proper internal validation
*/

-- Revoke execute from PUBLIC (this blocks anon access)
REVOKE EXECUTE ON FUNCTION create_workspace_with_admin FROM PUBLIC;

-- Grant execute only to authenticated role
GRANT EXECUTE ON FUNCTION create_workspace_with_admin TO authenticated;

-- Ensure the function has proper validation (recreate with stricter checks)
DROP FUNCTION IF EXISTS create_workspace_with_admin(TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION create_workspace_with_admin(
  workspace_name TEXT,
  workspace_slug TEXT,
  admin_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
  caller_id UUID;
BEGIN
  -- Get the authenticated user's ID
  caller_id := auth.uid();
  
  -- Strict validation: caller must be authenticated and match the admin_user_id
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  
  IF caller_id != admin_user_id THEN
    RAISE EXCEPTION 'Can only create workspace for yourself' USING ERRCODE = '42501';
  END IF;

  -- Validate inputs
  IF workspace_name IS NULL OR length(trim(workspace_name)) = 0 THEN
    RAISE EXCEPTION 'Workspace name is required' USING ERRCODE = '22023';
  END IF;

  IF workspace_slug IS NULL OR length(trim(workspace_slug)) = 0 THEN
    RAISE EXCEPTION 'Workspace slug is required' USING ERRCODE = '22023';
  END IF;

  -- Insert the workspace
  INSERT INTO workspaces (name, slug)
  VALUES (trim(workspace_name), trim(workspace_slug))
  RETURNING id INTO new_workspace_id;

  -- Insert the admin member (this bypasses RLS timing issues)
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, admin_user_id, 'admin');

  RETURN new_workspace_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A workspace with this slug already exists' USING ERRCODE = '23505';
END;
$$;

-- Final permissions: only authenticated can execute
REVOKE ALL ON FUNCTION create_workspace_with_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_workspace_with_admin TO authenticated;
