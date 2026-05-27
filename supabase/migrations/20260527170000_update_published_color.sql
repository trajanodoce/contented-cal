-- Update "Published" status color to soft peach
UPDATE public.board_columns
SET color = '#FCE8DE'
WHERE name = 'Published';

-- Update seed function so new workspaces get the new color
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
    (NEW.id, 'Published', 5, '#FCE8DE'),
    (NEW.id, 'Completed', 6, '#B7CEEC');

  RETURN NEW;
END;
$$;
