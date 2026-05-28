-- Auto-archive content_items with channel = 'Meeting Notes' on insert.
--
-- Granola-synced standalone meeting-note items shouldn't appear in board,
-- calendar, list, or my-work views. Users link these notes to real tasks
-- via the GranolaNotePicker, which queries the Granola API directly
-- (not the content_items table), so picker functionality is unaffected.
--
-- Extends 20260527220000_add_archived_column.sql: that migration was a
-- one-time backfill; this one enforces the same rule going forward.

CREATE OR REPLACE FUNCTION public.auto_archive_meeting_notes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.channel = 'Meeting Notes' THEN
    NEW.archived := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_archive_meeting_notes ON public.content_items;
CREATE TRIGGER trg_auto_archive_meeting_notes
  BEFORE INSERT ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_archive_meeting_notes();

-- Backfill any meeting-note items synced after the prior one-time archive
-- but before this trigger landed. No-op if there are none.
UPDATE public.content_items
SET archived = true
WHERE channel = 'Meeting Notes' AND archived = false;
