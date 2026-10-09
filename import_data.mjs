import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Reading data from Markdown file...");
  const content = fs.readFileSync('../Nitikon_Database.md', 'utf8');
  
  // Extract the JSON array from the markdown file
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    console.error("Could not find JSON block in the markdown file.");
    process.exit(1);
  }
  
  const rawData = JSON.parse(jsonMatch[1]);
  console.log(`Found ${rawData.length} questions. Starting import...`);

  // 1. Create Category
  let { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'nitikon')
    .single();

  if (!category) {
    const { data: newCat, error } = await supabase
      .from('categories')
      .insert({ name: 'นิติกร', slug: 'nitikon', description: 'ข้อสอบตำแหน่งนิติกร' })
      .select('id')
      .single();
    if (error) throw error;
    category = newCat;
  }

  // 2. Create Exam
  let { data: exam } = await supabase
    .from('exams')
    .select('id')
    .eq('title', 'คลังข้อสอบนิติกร (ทั้งหมด)')
    .single();

  if (!exam) {
    const { data: newExam, error } = await supabase
      .from('exams')
      .insert({ 
        category_id: category.id, 
        title: 'คลังข้อสอบนิติกร (ทั้งหมด)',
        description: 'รวมข้อสอบทั้งหมดสำหรับนิติกร',
        time_limit_minutes: 999,
        total_questions: rawData.length,
        passing_score: 60.0
      })
      .select('id')
      .single();
    if (error) throw error;
    exam = newExam;
  }

  // 3. Process questions
  const topicsMap = new Map();
  let orderIndex = 1;

  for (const item of rawData) {
    // Check or create topic
    if (!topicsMap.has(item.category)) {
      const { data: topic, error } = await supabase
        .from('topics')
        .upsert({ category_id: category.id, name: item.category }, { onConflict: 'category_id, name' })
        .select('id')
        .single();
      
      if (!error && topic) {
          topicsMap.set(item.category, topic.id);
      } else {
          // If upsert fails (maybe no unique constraint), try select then insert
          const {data: existingTopic} = await supabase.from('topics').select('id').eq('name', item.category).eq('category_id', category.id).single();
          if (existingTopic) {
             topicsMap.set(item.category, existingTopic.id);
          } else {
             const {data: newTopic} = await supabase.from('topics').insert({ category_id: category.id, name: item.category }).select('id').single();
             topicsMap.set(item.category, newTopic.id);
          }
      }
    }

    const topicId = topicsMap.get(item.category);

    // Insert Question
    const { data: question, error: qError } = await supabase
      .from('questions')
      .insert({
        exam_id: exam.id,
        topic_id: topicId,
        question_text: item.question,
        explanation: item.answer.explanation,
        order_index: orderIndex++
      })
      .select('id')
      .single();

    if (qError) {
      console.error("Error inserting question", qError);
      continue;
    }

    // Insert Choices
    const choicesToInsert = Object.entries(item.choices).map(([key, text], index) => {
      return {
        question_id: question.id,
        choice_text: `${key}. ${text}`,
        is_correct: key === item.answer.choice,
        order_index: index + 1
      };
    });

    const { error: cError } = await supabase.from('choices').insert(choicesToInsert);
    if (cError) {
       console.error("Error inserting choices", cError);
    }
  }

  console.log("Import completed!");
}

main().catch(console.error);
