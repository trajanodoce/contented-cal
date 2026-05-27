-- Add 'file' to the platform_type enum for uploaded file assets
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'file';
