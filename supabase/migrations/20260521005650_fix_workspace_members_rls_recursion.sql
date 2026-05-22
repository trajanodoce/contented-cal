/*
  # Fix workspace_members RLS infinite recursion

  1. Problem
    - The SELECT policy on workspace_members references workspace_members itself,
      causing infinite recursion when Postgres evaluates the policy.
  
  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS to look up
      which workspace IDs the current user belongs to.
    - Replace the self-referencing policy with one that calls this function.
  
  3. Changes
    - New function: get_user_workspace_ids() returns set of uuid
    - Drop and recreate SELECT policy on workspace_members
    - Drop and recreate SELECT policy on workspaces (uses same pattern)
*/

-- Helper function that bypasses RLS to get current user's workspace IDs
CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid();
$$;

-- Fix workspace_members SELECT policy
DROP POLICY IF EXISTS "Members can view workspace membership" ON workspace_members;
CREATE POLICY "Members can view workspace membership"
  ON workspace_members FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Fix workspaces SELECT policy (also referenced workspace_members directly)
DROP POLICY IF EXISTS "Members can view their workspaces" ON workspaces;
CREATE POLICY "Members can view their workspaces"
  ON workspaces FOR SELECT TO authenticated
  USING (id IN (SELECT get_user_workspace_ids()));

-- Fix workspaces UPDATE policy
DROP POLICY IF EXISTS "Admins can update workspace" ON workspaces;
CREATE POLICY "Admins can update workspace"
  ON workspaces FOR UPDATE TO authenticated
  USING (id IN (
    SELECT workspace_id FROM workspace_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (id IN (
    SELECT workspace_id FROM workspace_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Fix workspace_members UPDATE policy (also self-references)
DROP POLICY IF EXISTS "Admins can update member roles" ON workspace_members;
CREATE POLICY "Admins can update member roles"
  ON workspace_members FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT get_user_workspace_ids()
  ) AND EXISTS (
    SELECT 1 FROM workspace_members wm 
    WHERE wm.workspace_id = workspace_members.workspace_id 
    AND wm.user_id = auth.uid() AND wm.role = 'admin'
  ))
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));

-- Fix workspace_members DELETE policy
DROP POLICY IF EXISTS "Admins or self can remove members" ON workspace_members;
CREATE POLICY "Admins or self can remove members"
  ON workspace_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members wm 
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );
