-- ============================================================================
-- Task Category Scoping (Sub-phase A)
-- ============================================================================
-- Adds the foundation for differentiating Content vs Design tasks and scoping
-- custom fields to the right work-type. Per the UI/UX v2 update doc and
-- subsequent discussion:
--
--   - `content_items.category` lives on the task itself (NOT on content_types).
--     A single content_type (e.g. "Blog Post") can spawn both a content task
--     (writing the post) and a design task (designing the hero image) as
--     peer tasks in the same project.
--
--   - `custom_field_definitions.applies_to` scopes fields by work-type.
--     'content' fields show only on content tasks; 'design' only on design;
--     'both' (default) on every task.
--
--   - Existing differentiation lives in tags (['design-request']) and
--     custom_fields._source ('design-request'). We backfill from those signals.
--
-- Voice + Target Persona get explicitly scoped to 'content' (creative writing
-- tools; designers can use comments instead).
-- ============================================================================

-- 1. Create enums
DO $$ BEGIN
  CREATE TYPE task_category AS ENUM ('content', 'design');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE field_applies_to AS ENUM ('content', 'design', 'both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add content_items.category (the task's work-type)
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS category task_category NOT NULL DEFAULT 'content';

CREATE INDEX IF NOT EXISTS idx_content_items_category
  ON content_items (workspace_id, category)
  WHERE archived = false;

COMMENT ON COLUMN content_items.category IS
  'Task work-type: content (writing/editing) or design (visual/imagery). Set by which create-flow spawned the task. Backfilled from tags + custom_fields._source on 2026-06-04.';

-- 3. Add custom_field_definitions.applies_to (which task types a field shows on)
ALTER TABLE custom_field_definitions
  ADD COLUMN IF NOT EXISTS applies_to field_applies_to NOT NULL DEFAULT 'both';

COMMENT ON COLUMN custom_field_definitions.applies_to IS
  'Field visibility scope by task category. content = only on content tasks; design = only on design tasks; both = on every task.';

-- 4. Backfill: anything tagged 'design-request' OR with _source='design-request'
--    becomes a design task. Everything else stays 'content' (the column default).
UPDATE content_items
SET category = 'design'
WHERE category = 'content'  -- only touch unset rows (idempotent on re-run)
  AND (
    tags @> ARRAY['design-request']::text[]
    OR (custom_fields->>'_source') = 'design-request'
  );

-- 5. Scope Voice + Target Persona to content tasks (writing-specific tools).
--    All other existing custom fields stay at the 'both' default.
UPDATE custom_field_definitions
SET applies_to = 'content'
WHERE name IN ('Voice', 'Target Persona');
