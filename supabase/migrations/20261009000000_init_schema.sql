-- ============================================================================
-- 1. ตาราง Categories (หมวดหมู่หลัก)
-- ============================================================================
CREATE TABLE public.categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 2. ตาราง Topics (สาระวิชา/หัวข้อย่อย)
-- ============================================================================
CREATE TABLE public.topics (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES public.topics(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. ตาราง Exams (ชุดข้อสอบ)
-- ============================================================================
CREATE TABLE public.exams (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    time_limit_minutes INTEGER DEFAULT 120,
    total_questions INTEGER DEFAULT 0,
    passing_score NUMERIC(5,2) DEFAULT 60.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 4. ตาราง Questions (ข้อสอบรายข้อ)
-- ============================================================================
CREATE TABLE public.questions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    topic_id INTEGER REFERENCES public.topics(id) ON DELETE SET NULL,
    context_content TEXT,
    media_url TEXT,
    question_text TEXT NOT NULL,
    explanation TEXT,
    question_type TEXT DEFAULT 'multiple_choice',
    score_weight NUMERIC(4,2) DEFAULT 1.00,
    order_index INTEGER NOT NULL DEFAULT 0
);

-- ============================================================================
-- 5. ตาราง Choices (ตัวเลือกคำตอบ)
-- ============================================================================
CREATE TABLE public.choices (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    choice_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL DEFAULT 0
);

-- ============================================================================
-- 6. ตาราง ExamAttempts (ประวัติการเข้าสอบในแต่ละรอบ)
-- ============================================================================
CREATE TABLE public.exam_attempts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_id INTEGER NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    finished_at TIMESTAMP WITH TIME ZONE,
    time_spent_seconds INTEGER DEFAULT 0,
    total_score NUMERIC(6,2) DEFAULT 0.00,
    status TEXT DEFAULT 'in_progress'
);

-- ============================================================================
-- 7. ตาราง ExamAttemptAnswers (คำตอบที่เลือกในแต่ละข้อของการสอบแต่ละรอบ)
-- ============================================================================
CREATE TABLE public.exam_attempt_answers (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_choice_id INTEGER REFERENCES public.choices(id) ON DELETE SET NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- กำหนดสิทธิ์ RLS (Row Level Security) อย่างง่าย
-- ============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempt_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public read access on topics" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Allow public read access on exams" ON public.exams FOR SELECT USING (true);
CREATE POLICY "Allow public read access on questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Allow public read access on choices" ON public.choices FOR SELECT USING (true);

-- อนุญาตให้ผู้ใช้จัดการข้อมูลการสอบของตัวเอง
CREATE POLICY "Users can insert their own exam attempts" ON public.exam_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select their own exam attempts" ON public.exam_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own exam attempts" ON public.exam_attempts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage answers for their attempts" ON public.exam_attempt_answers 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.exam_attempts 
        WHERE id = exam_attempt_answers.attempt_id AND user_id = auth.uid()
    )
);
