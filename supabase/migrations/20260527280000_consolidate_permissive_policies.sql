-- Performance: collapse multiple permissive policies for the same role+action
-- so Postgres only evaluates one predicate per row instead of OR'ing across
-- two policies per row.
--
-- Pattern for linear_issue_links, notion_page_links, sync_field_mappings,
-- sync_schedule: an "Admins can manage" FOR ALL policy and a separate
-- "Members can view" FOR SELECT policy. ALL covers SELECT, so both fire
-- on every read. Since admins/editors are also workspace members, the
-- member predicate already covers them — splitting the ALL policy into
-- explicit INSERT/UPDATE/DELETE removes the SELECT overlap with no
-- semantic change.
--
-- Pattern for intake_submissions: two INSERT policies for authenticated
-- (public-form path + workspace-member path). Merge into one INSERT
-- policy with an OR'd predicate; anon role keeps public-form access via
-- the same merged policy.
--
-- Advisor: multiple_permissive_policies (9 findings → 0).

-- ── linear_issue_links ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and editors can manage linear links" ON public.linear_issue_links;

CREATE POLICY "Admins and editors can insert linear links" ON public.linear_issue_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = linear_issue_links.content_item_id
        AND get_workspace_role(ci.workspace_id) = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

CREATE POLICY "Admins and editors can update linear links" ON public.linear_issue_links
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = linear_issue_links.content_item_id
        AND get_workspace_role(ci.workspace_id) = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = linear_issue_links.content_item_id
        AND get_workspace_role(ci.workspace_id) = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

CREATE POLICY "Admins and editors can delete linear links" ON public.linear_issue_links
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = linear_issue_links.content_item_id
        AND get_workspace_role(ci.workspace_id) = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

-- ── notion_page_links ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and editors can manage notion links" ON public.notion_page_links;

CREATE POLICY "Admins and editors can insert notion links" ON public.notion_page_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = notion_page_links.content_item_id
        AND get_workspace_role(ci.workspace_id) = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

CREATE POLICY "Admins and editors can update notion links" ON public.notion_page_links
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = notion_page_links.content_item_id
        AND get_workspace_role(ci.workspace_id) = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = notion_page_links.content_item_id
        AND get_workspace_role(ci.workspace_id) = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

CREATE POLICY "Admins and editors can delete notion links" ON public.notion_page_links
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = notion_page_links.content_item_id
        AND get_workspace_role(ci.workspace_id) = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

-- ── sync_field_mappings ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage sync mappings" ON public.sync_field_mappings;

CREATE POLICY "Admins can insert sync mappings" ON public.sync_field_mappings
  FOR INSERT TO authenticated
  WITH CHECK (get_workspace_role(workspace_id) = 'admin'::workspace_role);

CREATE POLICY "Admins can update sync mappings" ON public.sync_field_mappings
  FOR UPDATE TO authenticated
  USING (get_workspace_role(workspace_id) = 'admin'::workspace_role)
  WITH CHECK (get_workspace_role(workspace_id) = 'admin'::workspace_role);

CREATE POLICY "Admins can delete sync mappings" ON public.sync_field_mappings
  FOR DELETE TO authenticated
  USING (get_workspace_role(workspace_id) = 'admin'::workspace_role);

-- ── sync_schedule ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage sync schedule" ON public.sync_schedule;

CREATE POLICY "Admins can insert sync schedule" ON public.sync_schedule
  FOR INSERT
  WITH CHECK (get_workspace_role(workspace_id) = 'admin'::workspace_role);

CREATE POLICY "Admins can update sync schedule" ON public.sync_schedule
  FOR UPDATE
  USING (get_workspace_role(workspace_id) = 'admin'::workspace_role)
  WITH CHECK (get_workspace_role(workspace_id) = 'admin'::workspace_role);

CREATE POLICY "Admins can delete sync schedule" ON public.sync_schedule
  FOR DELETE
  USING (get_workspace_role(workspace_id) = 'admin'::workspace_role);

-- ── intake_submissions: merge two INSERT policies into one ───────────
DROP POLICY IF EXISTS "Anyone can submit to public forms" ON public.intake_submissions;
DROP POLICY IF EXISTS "Members can submit to workspace forms" ON public.intake_submissions;

CREATE POLICY "Submit to public or workspace forms" ON public.intake_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM intake_forms f
      WHERE f.id = intake_submissions.form_id
        AND (f.is_public = true OR is_workspace_member(f.workspace_id))
    )
  );
