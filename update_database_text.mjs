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

function cleanThaiText(str) {
  if (!str) return '';
  let s = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const PARAGRAPH_PLACEHOLDER = '\n\n__PARAGRAPH__\n\n';
  s = s.replace(/\n\s*\n+/g, PARAGRAPH_PLACEHOLDER);

  const rawParagraphs = s.split(PARAGRAPH_PLACEHOLDER);
  const cleanedParagraphs = rawParagraphs.map((para) => {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) return lines.join('');

    let result = lines[0];
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1];
      const current = lines[i];
      const prevLastChar = prev.slice(-1);
      const currFirstChar = current.charAt(0);

      const isThaiPrev = /[\u0E00-\u0E7F]/.test(prevLastChar);
      const isThaiCurr = /[\u0E00-\u0E7F]/.test(currFirstChar);

      if (isThaiPrev && isThaiCurr) {
        result += current;
      } else {
        result += ' ' + current;
      }
    }
    return result;
  });

  return cleanedParagraphs.join('\n\n').trim();
}

async function main() {
  console.log("Fetching questions to clean...");
  
  // 1. Clean Questions
  let from = 0;
  const pageSize = 200;
  let totalUpdatedQuestions = 0;

  while (true) {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('id, question_text, explanation')
      .range(from, from + pageSize - 1)
      .order('id', { ascending: true });

    if (error) {
      console.error("Error fetching questions:", error);
      break;
    }
    if (!questions || questions.length === 0) break;

    for (const q of questions) {
      const hasNewlineInQ = q.question_text && q.question_text.includes('\n');
      const hasNewlineInExp = q.explanation && q.explanation.includes('\n');

      if (hasNewlineInQ || hasNewlineInExp) {
        const cleanedQ = cleanThaiText(q.question_text);
        const cleanedExp = cleanThaiText(q.explanation);

        const { error: updateErr } = await supabase
          .from('questions')
          .update({
            question_text: cleanedQ,
            explanation: cleanedExp
          })
          .eq('id', q.id);

        if (updateErr) {
          console.error(`Failed to update question ${q.id}:`, updateErr.message);
        } else {
          totalUpdatedQuestions++;
        }
      }
    }

    console.log(`Processed questions up to ID index ${from + questions.length}... (Updated: ${totalUpdatedQuestions})`);
    if (questions.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Finished updating questions: ${totalUpdatedQuestions} questions updated.`);

  // 2. Clean Choices
  console.log("Fetching choices to clean...");
  from = 0;
  let totalUpdatedChoices = 0;

  while (true) {
    const { data: choices, error } = await supabase
      .from('choices')
      .select('id, choice_text')
      .range(from, from + pageSize - 1)
      .order('id', { ascending: true });

    if (error) {
      console.error("Error fetching choices:", error);
      break;
    }
    if (!choices || choices.length === 0) break;

    for (const c of choices) {
      if (c.choice_text && c.choice_text.includes('\n')) {
        const cleanedC = cleanThaiText(c.choice_text);
        const { error: updateErr } = await supabase
          .from('choices')
          .update({ choice_text: cleanedC })
          .eq('id', c.id);

        if (updateErr) {
          console.error(`Failed to update choice ${c.id}:`, updateErr.message);
        } else {
          totalUpdatedChoices++;
        }
      }
    }

    if (from % 1000 === 0) {
      console.log(`Processed choices up to index ${from + choices.length}... (Updated: ${totalUpdatedChoices})`);
    }

    if (choices.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Finished updating choices: ${totalUpdatedChoices} choices updated.`);
  console.log("All database questions and choices have been cleaned successfully!");
}

main().catch(console.error);
