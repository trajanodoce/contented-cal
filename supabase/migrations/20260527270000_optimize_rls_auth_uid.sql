-- Performance: wrap auth.uid() calls in (SELECT auth.uid()) across all RLS
-- policies so Postgres treats them as InitPlan-cached values (evaluated once
-- per query) rather than re-evaluating per row. Same semantics, big win on
-- any sequential or large-result scan that goes through RLS.
-- Advisor finding: auth_rls_initplan (38 occurrences across 12 tables).

-- activity_log
ALTER POLICY "Admins and editors can log activity" ON public.activity_log
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_items ci
        JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = activity_log.content_item_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

-- comments
ALTER POLICY "Admins or authors can delete comments" ON public.comments
  USING (
    (user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = comments.content_item_id
        AND get_workspace_role(ci.workspace_id) = 'admin'::workspace_role
    )
  );

ALTER POLICY "Members can create comments" ON public.comments
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = comments.content_item_id
        AND is_workspace_member(ci.workspace_id)
    )
  );

ALTER POLICY "Users can update own comments" ON public.comments
  USING (user_id = (SELECT auth.uid()));

-- granola_note_links
ALTER POLICY "Users can delete own granola links" ON public.granola_note_links
  USING (owner_id = (SELECT auth.uid()));
ALTER POLICY "Users can insert own granola links" ON public.granola_note_links
  WITH CHECK (owner_id = (SELECT auth.uid()));
ALTER POLICY "Users can update own granola links" ON public.granola_note_links
  USING (owner_id = (SELECT auth.uid()));
ALTER POLICY "Users can view own granola links" ON public.granola_note_links
  USING (owner_id = (SELECT auth.uid()));

-- ordinal_post_links
ALTER POLICY "Editors and admins can delete ordinal links" ON public.ordinal_post_links
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
        JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = ordinal_post_links.content_item_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

ALTER POLICY "Editors and admins can insert ordinal links" ON public.ordinal_post_links
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_items ci
        JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = ordinal_post_links.content_item_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

ALTER POLICY "Editors and admins can update ordinal links" ON public.ordinal_post_links
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
        JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = ordinal_post_links.content_item_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

ALTER POLICY "Users can view ordinal links for their workspace content" ON public.ordinal_post_links
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
        JOIN workspace_members wm ON wm.workspace_id = ci.workspace_id
      WHERE ci.id = ordinal_post_links.content_item_id
        AND wm.user_id = (SELECT auth.uid())
    )
  );

-- ordinal_user_connections
ALTER POLICY ordinal_user_connections_delete ON public.ordinal_user_connections
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY ordinal_user_connections_insert ON public.ordinal_user_connections
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY ordinal_user_connections_select ON public.ordinal_user_connections
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY ordinal_user_connections_update ON public.ordinal_user_connections
  USING (user_id = (SELECT auth.uid()));

-- personal_tasks
ALTER POLICY "Users can delete own personal tasks" ON public.personal_tasks
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can insert own personal tasks" ON public.personal_tasks
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own personal tasks" ON public.personal_tasks
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can view own personal tasks" ON public.personal_tasks
  USING ((SELECT auth.uid()) = user_id);

-- profiles
ALTER POLICY "Users can insert their own profile" ON public.profiles
  WITH CHECK (id = (SELECT auth.uid()));
ALTER POLICY "Users can update their own profile" ON public.profiles
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- project_library
ALTER POLICY "Editors and admins can delete project library items" ON public.project_library
  USING (
    workspace_id IN (
      SELECT workspace_members.workspace_id
      FROM workspace_members
      WHERE workspace_members.user_id = (SELECT auth.uid())
        AND workspace_members.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

ALTER POLICY "Editors and admins can insert project library items" ON public.project_library
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_members.workspace_id
      FROM workspace_members
      WHERE workspace_members.user_id = (SELECT auth.uid())
        AND workspace_members.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

ALTER POLICY "Editors and admins can update project library items" ON public.project_library
  USING (
    workspace_id IN (
      SELECT workspace_members.workspace_id
      FROM workspace_members
      WHERE workspace_members.user_id = (SELECT auth.uid())
        AND workspace_members.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

ALTER POLICY "Members can view project library items" ON public.project_library
  USING (
    workspace_id IN (
      SELECT workspace_members.workspace_id
      FROM workspace_members
      WHERE workspace_members.user_id = (SELECT auth.uid())
    )
  );

-- project_members
ALTER POLICY "Editors and admins can manage project members" ON public.project_members
  WITH CHECK (
    project_id IN (
      SELECT projects.id
      FROM projects
      WHERE projects.workspace_id IN (
        SELECT workspace_members.workspace_id
        FROM workspace_members
        WHERE workspace_members.user_id = (SELECT auth.uid())
          AND workspace_members.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
      )
    )
  );

ALTER POLICY "Editors and admins can remove project members" ON public.project_members
  USING (
    project_id IN (
      SELECT projects.id
      FROM projects
      WHERE projects.workspace_id IN (
        SELECT workspace_members.workspace_id
        FROM workspace_members
        WHERE workspace_members.user_id = (SELECT auth.uid())
          AND workspace_members.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
      )
    )
  );

ALTER POLICY "Members can view project members" ON public.project_members
  USING (
    project_id IN (
      SELECT projects.id
      FROM projects
      WHERE projects.workspace_id IN (
        SELECT workspace_members.workspace_id
        FROM workspace_members
        WHERE workspace_members.user_id = (SELECT auth.uid())
      )
    )
  );

-- user_integrations
ALTER POLICY "Users can delete own integrations" ON public.user_integrations
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY "Users can insert own integrations" ON public.user_integrations
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY "Users can update own integrations" ON public.user_integrations
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY "Users can view own integrations" ON public.user_integrations
  USING (user_id = (SELECT auth.uid()));

-- workspace_invites
ALTER POLICY workspace_invites_delete ON public.workspace_invites
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = 'admin'::workspace_role
    )
  );

ALTER POLICY workspace_invites_insert ON public.workspace_invites
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = 'admin'::workspace_role
    )
  );

ALTER POLICY workspace_invites_select ON public.workspace_invites
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = (SELECT auth.uid())
    )
  );

ALTER POLICY workspace_invites_update ON public.workspace_invites
  USING (
    email = ((SELECT u.email FROM auth.users u WHERE u.id = (SELECT auth.uid())))::text
    OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  )
  WITH CHECK (
    email = ((SELECT u.email FROM auth.users u WHERE u.id = (SELECT auth.uid())))::text
    OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role = ANY (ARRAY['admin'::workspace_role, 'editor'::workspace_role])
    )
  );

-- workspaces
ALTER POLICY "Authenticated users can create their own workspaces" ON public.workspaces
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
