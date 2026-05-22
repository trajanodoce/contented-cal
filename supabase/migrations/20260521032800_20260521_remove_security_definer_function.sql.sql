/*
  # Remove SECURITY DEFINER function security vulnerability

  1. Security Issue Fixed
    - Removes the create_workspace_with_admin RPC function that was exposed via REST API
    - Eliminates SECURITY DEFINER bypass vulnerability
    - Frontend will use direct inserts with proper RLS policies instead

  2. Alternative Approach
    - The frontend will insert workspace and member separately
    - Proper RLS policies already exist to protect the tables
    - The race condition is handled with a small delay in the frontend
*/

-- Drop the SECURITY DEFINER function to remove REST API exposure
DROP FUNCTION IF EXISTS create_workspace_with_admin(TEXT, TEXT, UUID);
