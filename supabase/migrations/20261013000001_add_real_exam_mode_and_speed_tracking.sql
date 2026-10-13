-- Add exam_mode and time_limit_seconds to exam_attempts
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS exam_mode TEXT DEFAULT 'practice';
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER DEFAULT 10800;

-- Add time_spent_seconds to individual question answers for speed & pacing analysis
ALTER TABLE public.exam_attempt_answers ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0;
