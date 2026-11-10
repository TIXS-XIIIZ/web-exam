-- Create study_notes table for exam preparation materials and study notes
CREATE TABLE IF NOT EXISTS public.study_notes (
    id TEXT PRIMARY KEY,
    category_id INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    source_file TEXT,
    source_line_start INTEGER,
    source_line_end INTEGER,
    content_sha256 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for ordering and filtering
CREATE INDEX IF NOT EXISTS idx_study_notes_sequence ON public.study_notes (sequence);
CREATE INDEX IF NOT EXISTS idx_study_notes_category ON public.study_notes (category);

-- Enable RLS
ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on study_notes" ON public.study_notes FOR SELECT USING (true);
