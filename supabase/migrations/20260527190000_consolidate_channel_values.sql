-- Consolidate individual social channel names into "Social"
UPDATE public.content_items
SET channel = 'Social'
WHERE channel IN ('LinkedIn', 'Twitter/X', 'Twitter', 'Instagram', 'Facebook', 'YouTube', 'TikTok', 'Social Media');

-- Rename "Email" to "Newsletter/Email" for consistency
UPDATE public.content_items
SET channel = 'Newsletter/Email'
WHERE channel = 'Email';
