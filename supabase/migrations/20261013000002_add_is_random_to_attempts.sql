-- Add is_random to exam_attempts to record whether question & choice order was randomized
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS is_random BOOLEAN DEFAULT false;
