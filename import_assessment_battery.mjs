import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: fileURLToPath(new URL('.env.local', import.meta.url)), quiet: true });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const publicDb = createClient(url, anonKey, { auth: { persistSession: false } });

const check = (result) => {
  if (result.error) throw result.error;
  return result.data;
};

async function main() {
  console.log('=== Step 1: Loading and validating Nitikon_20261101_4Files_Database.md ===');
  const files4Path = new URL('./data/Nitikon_20261101_4Files_Database.md', import.meta.url);
  const files4Markdown = fs.readFileSync(files4Path, 'utf8');
  const blocks4 = [...files4Markdown.matchAll(/```json([\s\S]*?)```/g)];
  if (blocks4.length < 2) {
    throw new Error('Failed to find JSON question array block in Nitikon_20261101_4Files_Database.md');
  }
  const questions4 = JSON.parse(blocks4[1][1].trim());
  const letters = ['ก', 'ข', 'ค', 'ง'];

  if (questions4.length !== 135) {
    throw new Error(`Expected 135 questions, got ${questions4.length}`);
  }

  for (const q of questions4) {
    if (!q.id || !q.category || !q.question || !q.choices || !q.answer?.choice) {
      throw new Error(`Invalid question data in ${q.id}`);
    }
    if (!letters.includes(q.answer.choice)) {
      throw new Error(`Invalid answer choice "${q.answer.choice}" in ${q.id}`);
    }
    for (const letter of letters) {
      if (!q.choices[letter]) {
        throw new Error(`Missing choice "${letter}" in ${q.id}`);
      }
    }
  }
  console.log(`Validated ${questions4.length} questions from 4Files.`);

  console.log('\n=== Step 2: Loading and validating Nitikon_20261106_1_Study_Database.md ===');
  const studyPath = new URL('./data/Nitikon_20261106_1_Study_Database.md', import.meta.url);
  const studyMarkdown = fs.readFileSync(studyPath, 'utf8');
  const studyBlocks = [...studyMarkdown.matchAll(/```json([\s\S]*?)```/g)];
  if (studyBlocks.length < 1) {
    throw new Error('Failed to find JSON study notes block in Nitikon_20261106_1_Study_Database.md');
  }
  const studyNotes = JSON.parse(studyBlocks[0][1].trim());

  if (studyNotes.length !== 57) {
    throw new Error(`Expected 57 study notes, got ${studyNotes.length}`);
  }

  for (const note of studyNotes) {
    if (!note.id || !note.title || !note.content || typeof note.sequence !== 'number') {
      throw new Error(`Invalid study note data in ${note.id}`);
    }
  }
  console.log(`Validated ${studyNotes.length} study notes.`);

  console.log('\n=== Step 3: Preparing Database Entities ===');
  const category = check(await db.from('categories').select('id').eq('slug', 'nitikon').single());
  const exam = check(await db.from('exams').select('id').eq('title', 'คลังข้อสอบนิติกร (ทั้งหมด)').single());
  console.log(`Category ID: ${category.id}, Exam ID: ${exam.id}`);

  // Fetch all topics
  const topicRows = check(await db.from('topics').select('id, name').eq('category_id', category.id));
  const topicsMap = new Map(topicRows.map((t) => [t.name, t.id]));

  // Ensure all categories from 4Files exist as topics
  const uniqueCategories = [...new Set(questions4.map((q) => q.category))];
  for (const catName of uniqueCategories) {
    if (!topicsMap.has(catName)) {
      console.log(`Creating topic: "${catName}"`);
      const created = check(
        await db.from('topics').insert({ category_id: category.id, name: catName }).select('id').single()
      );
      topicsMap.set(catName, created.id);
    }
  }

  // Check existing questions
  const existingRows = check(
    await db.from('questions').select('id, context_content').eq('exam_id', exam.id)
  );
  const existingSourceMap = new Map();
  for (const r of existingRows) {
    try {
      const parsed = JSON.parse(r.context_content);
      if (parsed.source_id) existingSourceMap.set(parsed.source_id, r.id);
    } catch {}
  }

  const { data: lastQuestion, error: lastError } = await db
    .from('questions')
    .select('order_index')
    .eq('exam_id', exam.id)
    .order('order_index', { ascending: false })
    .limit(1);
  if (lastError) throw lastError;

  let nextOrder = (lastQuestion[0]?.order_index ?? 0) + 1;
  let addedQuestions = 0;
  let skippedQuestions = 0;

  console.log(`\n=== Step 4: Importing 135 Questions and Choices ===`);
  for (const item of questions4) {
    const topicId = topicsMap.get(item.category);
    let questionId = existingSourceMap.get(item.id);

    if (!questionId) {
      const contextContent = JSON.stringify({
        source_id: item.id,
        source_heading: item.source_heading,
        source_file: item.source_file,
        source_question_number: item.source_question_number,
        sources: item.sources,
      });

      const inserted = check(
        await db
          .from('questions')
          .insert({
            exam_id: exam.id,
            topic_id: topicId,
            context_content: contextContent,
            question_text: item.question,
            explanation: item.answer.explanation,
            order_index: nextOrder,
          })
          .select('id')
          .single()
      );

      questionId = inserted.id;
      existingSourceMap.set(item.id, questionId);
      nextOrder++;
      addedQuestions++;

      // Insert choices
      const choices = letters.map((letter, idx) => ({
        question_id: questionId,
        choice_text: `${letter}. ${item.choices[letter]}`,
        is_correct: letter === item.answer.choice,
        order_index: idx + 1,
      }));

      check(await db.from('choices').insert(choices));
    } else {
      skippedQuestions++;
    }
  }

  console.log(`Questions imported: ${addedQuestions}, Skipped (already present): ${skippedQuestions}`);

  // Refresh exam total questions count
  const { count: examTotal, error: countErr } = await db
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', exam.id);
  if (countErr) throw countErr;
  check(await db.from('exams').update({ total_questions: examTotal }).eq('id', exam.id));
  console.log(`Updated exam total_questions to: ${examTotal}`);

  console.log('\n=== Step 5: Importing 57 Study Notes ===');
  let addedNotes = 0;

  for (const note of studyNotes) {
    const noteData = {
      id: note.id,
      category_id: category.id,
      category: note.category,
      title: note.title,
      content: note.content,
      sequence: note.sequence,
      source_file: note.source_file,
      source_line_start: note.source_line_start,
      source_line_end: note.source_line_end,
      content_sha256: note.content_sha256,
    };

    const { error: upsertErr } = await db.from('study_notes').upsert(noteData, { onConflict: 'id' });
    if (upsertErr) throw upsertErr;
    addedNotes++;
  }
  console.log(`Study notes upserted: ${addedNotes}`);

  console.log('\n=== Step 6: Verifying with Public Anon Key ===');
  const { count: publicExamCount, error: publicExamErr } = await publicDb
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', exam.id);
  if (publicExamErr) throw publicExamErr;

  const { count: publicNotesCount, error: publicNotesErr } = await publicDb
    .from('study_notes')
    .select('id', { count: 'exact', head: true });
  if (publicNotesErr) throw publicNotesErr;

  console.log(`Publicly verified Exam questions count: ${publicExamCount}`);
  console.log(`Publicly verified Study notes count: ${publicNotesCount}`);

  if (publicNotesCount !== 57) {
    throw new Error(`Verification mismatch: expected 57 study notes, found ${publicNotesCount}`);
  }

  console.log('\n🎉 ALL DATA POPULATED AND VERIFIED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Fatal error during population:', err);
  process.exit(1);
});
