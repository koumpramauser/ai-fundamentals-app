// data/supabase.js — All database logic via @supabase/supabase-js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key server-side
);

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────

async function createUser({ name, email, passwordHash, role = 'student' }) {
  const { data, error } = await supabase
    .from('users')
    .insert([{ name, email, password: passwordHash, role }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────
// TOPICS
// ─────────────────────────────────────────────

async function getAllTopics() {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function getTopicById(id) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function createTopic({ title, summary_text, podcast_url }) {
  const { data, error } = await supabase
    .from('topics')
    .insert([{ title, summary_text, podcast_url }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateTopic(id, { title, summary_text, podcast_url }) {
  const { data, error } = await supabase
    .from('topics')
    .update({ title, summary_text, podcast_url })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTopic(id) {
  const { error } = await supabase.from('topics').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────

async function getQuestionsByTopic(topicId) {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function getQuestionById(id) {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function createQuestion({ topic_id, type, text, options, correct_answer, rubric, keywords, points = 10 }) {
  const { data, error } = await supabase
    .from('questions')
    .insert([{ topic_id, type, text, options, correct_answer, rubric, keywords, points }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateQuestion(id, fields) {
  const { data, error } = await supabase
    .from('questions')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteQuestion(id) {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// SCORES
// ─────────────────────────────────────────────

async function getScoreByUser(userId) {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || { user_id: userId, total_points: 0 };
}

async function upsertScore(userId, pointsToAdd) {
  // Fetch current score first
  const current = await getScoreByUser(userId);
  const newTotal = (current.total_points || 0) + pointsToAdd;

  const { data, error } = await supabase
    .from('scores')
    .upsert(
      { user_id: userId, total_points: newTotal, last_updated: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getLeaderboard(limit = 15) {
  const { data, error } = await supabase
    .from('scores')
    .select('total_points, last_updated, users(id, name)')
    .order('total_points', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────
// ANSWERS (audit log)
// ─────────────────────────────────────────────

async function saveAnswer({ user_id, question_id, answer_text, score, ai_feedback }) {
  const { data, error } = await supabase
    .from('answers')
    .insert([{ user_id, question_id, answer_text, score, ai_feedback }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  supabase,
  // users
  createUser, getUserByEmail, getUserById,
  // topics
  getAllTopics, getTopicById, createTopic, updateTopic, deleteTopic,
  // questions
  getQuestionsByTopic, getQuestionById, createQuestion, updateQuestion, deleteQuestion,
  // scores
  getScoreByUser, upsertScore, getLeaderboard,
  // answers
  saveAnswer,
};
