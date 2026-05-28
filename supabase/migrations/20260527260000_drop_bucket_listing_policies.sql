-- Drop the broad SELECT policies on storage.objects for the two public
-- buckets (project-files, workspace-assets). Public buckets serve files
-- via CDN URLs without needing a SELECT policy on storage.objects; these
-- policies only enabled the *listing* API — exposing file enumeration to
-- any authenticated user. The client only calls .upload, .getPublicUrl,
-- and .remove on these buckets (no .list or .download), so dropping the
-- policies has no effect on real flows. Confirmed: no edge function uses
-- the storage API either.
--
-- INSERT/UPDATE/DELETE policies are unchanged, so upload, edit, remove
-- continue to work normally.

DROP POLICY IF EXISTS "Members can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for workspace assets" ON storage.objects;
