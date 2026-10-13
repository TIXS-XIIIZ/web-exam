import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: fileURLToPath(new URL('.env.local', import.meta.url)), quiet: true });

const sourcePath = new URL('./data/Nitikon_New_60_Database.md', import.meta.url);
const markdown = fs.readFileSync(sourcePath, 'utf8');
const block = markdown.match(/```json\s*([\s\S]*?)\s*```/);
if (!block) throw new Error('JSON block missing from source file');
const questions = JSON.parse(block[1]);
const letters = ['ก', 'ข', 'ค', 'ง'];
if (questions.length !== 60 || new Set(questions.map((q) => q.id)).size !== 60 ||
    questions.some((q) => !q.id || !q.category || !q.question || !q.source_heading ||
      !Number.isInteger(q.source_question_number) || !q.answer?.explanation ||
      !letters.includes(q.answer.choice) || letters.some((letter) => !q.choices?.[letter]))) {
  throw new Error('Source data failed validation');
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });
const check = (result) => {
  if (result.error) throw result.error;
  return result.data;
};

const category = check(await db.from('categories').select('id').eq('slug', 'nitikon').single());
const exam = check(await db.from('exams').select('id').eq('title', 'คลังข้อสอบนิติกร (ทั้งหมด)').single());
const topicRows = check(await db.from('topics').select('id,name').eq('category_id', category.id));
const topics = new Map(topicRows.map((topic) => [topic.name, topic.id]));
const existingRows = check(await db.from('questions').select('id,context_content')
  .eq('exam_id', exam.id).like('context_content', '{"source_id":"nitikon-new60-%'));
const existing = new Map(existingRows.map((row) => [JSON.parse(row.context_content).source_id, row.id]));
const { data: lastQuestion, error: lastError } = await db.from('questions')
  .select('order_index').eq('exam_id', exam.id).order('order_index', { ascending: false }).limit(1);
if (lastError) throw lastError;
let nextOrder = (lastQuestion[0]?.order_index ?? 0) + 1;
let added = 0;

for (const item of questions) {
  let topicId = topics.get(item.category);
  if (!topicId) {
    const topic = check(await db.from('topics').insert({ category_id: category.id, name: item.category }).select('id').single());
    topicId = topic.id;
    topics.set(item.category, topicId);
  }

  let questionId = existing.get(item.id);
  if (!questionId) {
    const inserted = check(await db.from('questions').insert({
      exam_id: exam.id,
      topic_id: topicId,
      context_content: JSON.stringify({
        source_id: item.id,
        source_heading: item.source_heading,
        source_question_number: item.source_question_number,
      }),
      question_text: `${item.source_heading}\n\n${item.question}`,
      explanation: item.answer.explanation,
      order_index: nextOrder,
    }).select('id').single());
    questionId = inserted.id;
    nextOrder++;
    added++;
  }

  const storedChoices = check(await db.from('choices').select('order_index').eq('question_id', questionId));
  const existingIndexes = new Set(storedChoices.map((choice) => choice.order_index));
  const missing = letters.flatMap((letter, index) => existingIndexes.has(index + 1) ? [] : [{
    question_id: questionId,
    choice_text: `${letter}. ${item.choices[letter]}`,
    is_correct: letter === item.answer.choice,
    order_index: index + 1,
  }]);
  if (missing.length) check(await db.from('choices').insert(missing));
}

const { count, error: countError } = await db.from('questions')
  .select('id', { count: 'exact', head: true }).eq('exam_id', exam.id);
if (countError) throw countError;
check(await db.from('exams').update({ total_questions: count }).eq('id', exam.id));
const imported = check(await db.from('questions')
  .select('id,context_content,choices(id,is_correct)').eq('exam_id', exam.id)
  .like('context_content', '{"source_id":"nitikon-new60-%'));
const sourceIds = imported.map((row) => JSON.parse(row.context_content).source_id);
if (imported.length !== 60 || new Set(sourceIds).size !== 60 ||
    imported.some((row) => row.choices.length !== 4 || row.choices.filter((choice) => choice.is_correct).length !== 1)) {
  throw new Error('Post-import validation failed');
}
const publicDb = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { count: publicCount, error: publicError } = await publicDb.from('questions')
  .select('id', { count: 'exact', head: true }).eq('exam_id', exam.id);
if (publicError || publicCount !== count) throw new Error(`Public question read failed: ${publicError?.message || publicCount}`);
console.log(`Imported ${added} new questions; ${questions.length} source questions present. Exam total: ${count}.`);
