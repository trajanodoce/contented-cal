-- Update existing intake form channel fields to single_select with new options
UPDATE public.intake_form_fields
SET field_type = 'single_select',
    options = '[{"value":"Blog","label":"Blog"},{"value":"Social","label":"Social"},{"value":"Newsletter/Email","label":"Newsletter/Email"},{"value":"Sales Enablement","label":"Sales Enablement"},{"value":"Promo","label":"Promo"},{"value":"Website","label":"Website"},{"value":"Other","label":"Other"}]'::jsonb
WHERE field_key = 'channel';
