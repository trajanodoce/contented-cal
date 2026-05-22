/*
  # Fix Function Search Path Security Issue

  1. Security Issue Fixed
    - The `get_ordinal_sync_status` function had a mutable search_path
    - This could allow the function to search for objects in unintended schemas
    - Fixed by explicitly setting search_path = 'public' to make it immutable

  2. Changes Made
    - Recreated the function with SET search_path = public
    - Function behavior remains identical, but search path is now fixed
*/

-- Recreate the function with fixed search path
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
