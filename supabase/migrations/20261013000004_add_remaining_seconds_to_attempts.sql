-- Add paused status support and remaining_seconds column to exam_attempts
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS remaining_seconds INTEGER;
