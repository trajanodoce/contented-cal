/*
  # Phase 1 Foundation Schema

  Creates all tables first, then adds policies, indexes, and triggers.
  
  Tables: workspaces, workspace_members, content_types, board_columns,
  projects, content_items, subtasks, comments, activity_log
  
  Security: RLS on all tables, workspace-scoped access, role-based policies.
  
  Seed: Trigger on workspace insert seeds 10 content types + 6 board columns.
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES (no foreign key cycles, order matters)
-- ============================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS content_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'FileText',
  color text NOT NULL DEFAULT '#6B7280',
  default_workflow JSONB DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6B7280',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  content_type_id uuid REFERENCES content_types(id) ON DELETE SET NULL,
  status uuid REFERENCES board_columns(id) ON DELETE SET NULL,
  assignee_ids uuid[] DEFAULT '{}',
  due_date date,
  publish_date date,
  channel text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags text[] DEFAULT '{}',
  description text DEFAULT '',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid REFERENCES content_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- workspaces
CREATE POLICY "Members can view their workspaces"
  ON workspaces FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid()));

CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update workspace"
  ON workspaces FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid() AND role = 'admin'));

-- workspace_members
CREATE POLICY "Members can view workspace membership"
  ON workspace_members FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "Users can join workspaces"
  ON workspace_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update member roles"
  ON workspace_members FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid() AND wm.role = 'admin'))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid() AND wm.role = 'admin'));

CREATE POLICY "Admins or self can remove members"
  ON workspace_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid() AND wm.role = 'admin')
  );

-- content_types
CREATE POLICY "Members can view content types"
  ON content_types FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert content types"
  ON content_types FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update content types"
  ON content_types FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete content types"
  ON content_types FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

-- board_columns
CREATE POLICY "Members can view board columns"
  ON board_columns FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert board columns"
  ON board_columns FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update board columns"
  ON board_columns FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete board columns"
  ON board_columns FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

-- projects
CREATE POLICY "Members can view projects"
  ON projects FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Editors and admins can create projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));

CREATE POLICY "Editors and admins can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor')))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

-- content_items
CREATE POLICY "Members can view content items"
  ON content_items FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Editors and admins can create content items"
  ON content_items FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));

CREATE POLICY "Editors and admins can update content items"
  ON content_items FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor')))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));

CREATE POLICY "Admins can delete content items"
  ON content_items FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

-- subtasks
CREATE POLICY "Members can view subtasks"
  ON subtasks FOR SELECT TO authenticated
  USING (content_item_id IN (SELECT id FROM content_items WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));

CREATE POLICY "Editors and admins can insert subtasks"
  ON subtasks FOR INSERT TO authenticated
  WITH CHECK (content_item_id IN (SELECT id FROM content_items WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor'))));

CREATE POLICY "Editors and admins can update subtasks"
  ON subtasks FOR UPDATE TO authenticated
  USING (content_item_id IN (SELECT id FROM content_items WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor'))))
  WITH CHECK (content_item_id IN (SELECT id FROM content_items WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor'))));

CREATE POLICY "Admins can delete subtasks"
  ON subtasks FOR DELETE TO authenticated
  USING (content_item_id IN (SELECT id FROM content_items WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin')));

-- comments
CREATE POLICY "Members can view comments"
  ON comments FOR SELECT TO authenticated
  USING (content_item_id IN (SELECT id FROM content_items WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can insert comments"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND content_item_id IN (SELECT id FROM content_items WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));

CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- activity_log
CREATE POLICY "Members can view activity log"
  ON activity_log FOR SELECT TO authenticated
  USING (content_item_id IN (SELECT id FROM content_items WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can insert activity log"
  ON activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND content_item_id IN (SELECT id FROM content_items WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_content_items_workspace_id ON content_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_content_type_id ON content_items(content_type_id);
CREATE INDEX IF NOT EXISTS idx_content_items_due_date ON content_items(due_date);
CREATE INDEX IF NOT EXISTS idx_content_types_workspace_id ON content_types(workspace_id);
CREATE INDEX IF NOT EXISTS idx_board_columns_workspace_id ON board_columns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comments_content_item_id ON comments(content_item_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_content_item_id ON activity_log(content_item_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_content_item_id ON subtasks(content_item_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION seed_workspace_defaults()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO content_types (workspace_id, name, icon, color) VALUES
    (NEW.id, 'Blog Post', 'FileText', '#3B82F6'),
    (NEW.id, 'Social Post', 'Share2', '#10B981'),
    (NEW.id, 'Email Campaign', 'Mail', '#F59E0B'),
    (NEW.id, 'Landing Page', 'Layout', '#8B5CF6'),
    (NEW.id, 'Customer Story', 'Users', '#EC4899'),
    (NEW.id, 'Webinar', 'Video', '#06B6D4'),
    (NEW.id, 'Video', 'Play', '#EF4444'),
    (NEW.id, 'Ad Creative', 'Image', '#F97316'),
    (NEW.id, 'One-Pager', 'AlignLeft', '#14B8A6'),
    (NEW.id, 'Press Release', 'Newspaper', '#6366F1');

  INSERT INTO board_columns (workspace_id, name, position, color) VALUES
    (NEW.id, 'Backlog', 0, '#6B7280'),
    (NEW.id, 'In Progress', 1, '#3B82F6'),
    (NEW.id, 'In Review', 2, '#F59E0B'),
    (NEW.id, 'Approved', 3, '#8B5CF6'),
    (NEW.id, 'Scheduled', 4, '#06B6D4'),
    (NEW.id, 'Published', 5, '#10B981');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_workspace_created
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION seed_workspace_defaults();
