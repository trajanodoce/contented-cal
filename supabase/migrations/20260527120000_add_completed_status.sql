-- Add "Completed" status column to all existing workspaces
-- and update the seed function for new workspaces.

-- 1. Add "Completed" to every existing workspace that doesn't already have it
INSERT INTO public.board_columns (workspace_id, name, position, color)
SELECT w.id, 'Completed', 6, '#22C55E'
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.board_columns bc
  WHERE bc.workspace_id = w.id AND bc.name = 'Completed'
);

-- 2. Recreate seed_workspace_defaults to include "Completed" for new workspaces
CREATE OR REPLACE FUNCTION public.seed_workspace_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.content_types (workspace_id, name, icon, color) VALUES
    (NEW.id, 'Blog Post', 'FileText', '#3B82F6'),
    (NEW.id, 'Social Post', 'Share2', '#8B5CF6'),
    (NEW.id, 'Email', 'Mail', '#10B981'),
    (NEW.id, 'Landing Page', 'Layout', '#F59E0B'),
    (NEW.id, 'Case Study', 'BookOpen', '#EC4899'),
    (NEW.id, 'Whitepaper', 'File', '#6366F1'),
    (NEW.id, 'Infographic', 'BarChart2', '#06B6D4'),
    (NEW.id, 'Video', 'Play', '#EF4444'),
    (NEW.id, 'Ad Creative', 'Image', '#F97316'),
    (NEW.id, 'One-Pager', 'AlignLeft', '#14B8A6'),
    (NEW.id, 'Press Release', 'Newspaper', '#6366F1');

  INSERT INTO public.board_columns (workspace_id, name, position, color) VALUES
    (NEW.id, 'Backlog', 0, '#6B7280'),
    (NEW.id, 'In Progress', 1, '#3B82F6'),
    (NEW.id, 'In Review', 2, '#F59E0B'),
    (NEW.id, 'Approved', 3, '#8B5CF6'),
    (NEW.id, 'Scheduled', 4, '#06B6D4'),
    (NEW.id, 'Published', 5, '#10B981'),
    (NEW.id, 'Completed', 6, '#22C55E');

  RETURN NEW;
END;
$$;
