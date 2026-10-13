-- Add topic_id and custom_title to exam_attempts
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES public.topics(id) ON DELETE SET NULL;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS custom_title TEXT;
