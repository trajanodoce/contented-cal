-- Add archived column to content_items
ALTER TABLE public.content_items ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX idx_content_items_archived ON public.content_items (archived) WHERE archived = true;

-- Archive all items with channel = 'Meeting Notes'
UPDATE public.content_items
SET archived = true
WHERE channel = 'Meeting Notes';
