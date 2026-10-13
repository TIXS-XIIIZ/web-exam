-- Create custom_exam_sets table to store user-created custom exam sets
CREATE TABLE IF NOT EXISTS public.custom_exam_sets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_id INTEGER NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    topic_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_questions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.custom_exam_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_exam_sets
CREATE POLICY "Users can select their own custom exam sets"
ON public.custom_exam_sets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom exam sets"
ON public.custom_exam_sets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom exam sets"
ON public.custom_exam_sets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom exam sets"
ON public.custom_exam_sets FOR DELETE
USING (auth.uid() = user_id);

-- Add custom_set_id and topic_ids to exam_attempts table for tracking custom sets
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS custom_set_id INTEGER REFERENCES public.custom_exam_sets(id) ON DELETE SET NULL;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS topic_ids JSONB;
