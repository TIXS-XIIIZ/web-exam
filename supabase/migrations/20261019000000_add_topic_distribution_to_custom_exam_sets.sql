-- Add topic_distribution column to custom_exam_sets and exam_attempts
-- topic_distribution stores JSON array of: { topic_id: number, count: number, percent: number }
ALTER TABLE public.custom_exam_sets ADD COLUMN IF NOT EXISTS topic_distribution JSONB;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS topic_distribution JSONB;
