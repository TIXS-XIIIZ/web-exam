-- Allow users to delete their own exam attempts
CREATE POLICY "Users can delete their own exam attempts" 
ON public.exam_attempts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Ensure users can delete their own exam attempt answers
CREATE POLICY "Users can delete their own attempt answers" 
ON public.exam_attempt_answers 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.exam_attempts 
        WHERE id = exam_attempt_answers.attempt_id AND user_id = auth.uid()
    )
);
