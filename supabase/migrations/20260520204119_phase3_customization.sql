/*
  # Phase 3: Customization Schema

  ## New Tables

  1. `custom_field_definitions`
     - Defines extra fields per workspace or per content type
     - field_type: text | long_text | number | date | single_select | multi_select | url | checkbox | user
     - options: JSONB for select options [{value, label}]
     - position: display order

  2. `intake_forms`
     - Shareable forms for external content requests
     - is_public: true = no login required, false = workspace members only
     - share_slug: unique URL slug

  3. `intake_form_fields`
     - Fields on an intake form (can be standard fields or custom)
     - conditional_on: {field_key, value} — show only when another field equals a value

  4. `intake_submissions`
     - Submitted form responses
     - converted_to_content_item_id: set when submission is converted

  ## Security
  - RLS on all new tables, workspace-scoped
  - intake_forms with is_public=true accessible without auth for SELECT
  - intake_submissions insertable without auth (for public forms)
*/

-- ============================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_type_id uuid REFERENCES content_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','long_text','number','date','single_select','multi_select','url','checkbox','user')),
  options JSONB DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view custom field definitions"
  ON custom_field_definitions FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert custom field definitions"
  ON custom_field_definitions FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update custom field definitions"
  ON custom_field_definitions FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete custom field definitions"
  ON custom_field_definitions FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_workspace ON custom_field_definitions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_content_type ON custom_field_definitions(content_type_id);

-- ============================================================
-- INTAKE FORMS
-- ============================================================
CREATE TABLE IF NOT EXISTS intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_type_id uuid REFERENCES content_types(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text DEFAULT '',
  is_public boolean NOT NULL DEFAULT false,
  share_slug text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view intake forms"
  ON intake_forms FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Public forms are viewable by anyone"
  ON intake_forms FOR SELECT TO anon
  USING (is_public = true);

CREATE POLICY "Admins can insert intake forms"
  ON intake_forms FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update intake forms"
  ON intake_forms FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete intake forms"
  ON intake_forms FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_intake_forms_workspace ON intake_forms(workspace_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_slug ON intake_forms(share_slug);

-- ============================================================
-- INTAKE FORM FIELDS
-- ============================================================
CREATE TABLE IF NOT EXISTS intake_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES intake_forms(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  conditional_on JSONB DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE intake_form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fields for public forms"
  ON intake_form_fields FOR SELECT TO anon
  USING (form_id IN (SELECT id FROM intake_forms WHERE is_public = true));

CREATE POLICY "Members can view form fields"
  ON intake_form_fields FOR SELECT TO authenticated
  USING (form_id IN (
    SELECT id FROM intake_forms WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Admins can manage form fields"
  ON intake_form_fields FOR INSERT TO authenticated
  WITH CHECK (form_id IN (
    SELECT id FROM intake_forms WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  ));

CREATE POLICY "Admins can update form fields"
  ON intake_form_fields FOR UPDATE TO authenticated
  USING (form_id IN (
    SELECT id FROM intake_forms WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  ))
  WITH CHECK (form_id IN (
    SELECT id FROM intake_forms WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  ));

CREATE POLICY "Admins can delete form fields"
  ON intake_form_fields FOR DELETE TO authenticated
  USING (form_id IN (
    SELECT id FROM intake_forms WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  ));

CREATE INDEX IF NOT EXISTS idx_intake_form_fields_form ON intake_form_fields(form_id);

-- ============================================================
-- INTAKE SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES intake_forms(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_by_email text,
  created_at timestamptz DEFAULT now(),
  converted_to_content_item_id uuid REFERENCES content_items(id) ON DELETE SET NULL
);

ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit to public forms"
  ON intake_submissions FOR INSERT TO anon
  WITH CHECK (form_id IN (SELECT id FROM intake_forms WHERE is_public = true));

CREATE POLICY "Authenticated users can submit"
  ON intake_submissions FOR INSERT TO authenticated
  WITH CHECK (
    form_id IN (
      SELECT id FROM intake_forms WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
    OR form_id IN (SELECT id FROM intake_forms WHERE is_public = true)
  );

CREATE POLICY "Members can view submissions"
  ON intake_submissions FOR SELECT TO authenticated
  USING (form_id IN (
    SELECT id FROM intake_forms WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Admins can update submissions"
  ON intake_submissions FOR UPDATE TO authenticated
  USING (form_id IN (
    SELECT id FROM intake_forms WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  ))
  WITH CHECK (form_id IN (
    SELECT id FROM intake_forms WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  ));

CREATE POLICY "Admins can delete submissions"
  ON intake_submissions FOR DELETE TO authenticated
  USING (form_id IN (
    SELECT id FROM intake_forms WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  ));

CREATE INDEX IF NOT EXISTS idx_intake_submissions_form ON intake_submissions(form_id);
