const path = require('path');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');// api/index.js — Vercel Serverless Entry Point
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = require('../data/supabase');
const { gradeOpenAnswer, reviewPseudocode } = require('../services/gemini');
const { requireLogin, requireAdmin, requireStudent } = require('../middleware/auth');
const { markdownToHtml } = require('../helpers/markdown');

const app = express();

// ─────────────────────────────────────────────
// View Engine & Static
// ─────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// ─────────────────────────────────────────────
// Session (stateless-compatible for Vercel)
// ─────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'studyai-fau-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8 // 8 hours
  }
}));

// Register template helpers
app.locals.markdownToHtml = markdownToHtml;

// Inject session user into all views
app.use((req, res, next) => {
  res.locals.sessionUser = req.session.userId ? {
    id: req.session.userId,
    name: req.session.name,
    role: req.session.role
  } : null;
  next();
});

// ─────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────

app.get('/', (req, res) => {
  if (req.session.userId) {
    return req.session.role === 'admin'
      ? res.redirect('/admin/dashboard')
      : res.redirect('/student/dashboard');
      app.get('/', (req, res) => {
  res.redirect('/auth/login'); // Veya ana sayfan hangisiyse ona yönlendir
});
  }
  res.render('auth/login', { error: null });
});

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/login', { error: req.query.error || null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.getUserByEmail(email.trim().toLowerCase());
    if (!user) return res.render('auth/login', { error: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.render('auth/login', { error: 'Invalid email or password.' });

    req.session.userId = user.id;
    req.session.name = user.name;
    req.session.role = user.role;

    return user.role === 'admin'
      ? res.redirect('/admin/dashboard')
      : res.redirect('/student/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('auth/login', { error: 'Server error. Please try again.' });
  }
});

app.get('/register', (req, res) => {
  res.render('auth/register', { error: null });
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await db.getUserByEmail(email.trim().toLowerCase());
    if (existing) return res.render('auth/register', { error: 'Email already registered.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.createUser({ name, email: email.trim().toLowerCase(), passwordHash, role: 'student' });

    // Initialize score row
    await db.upsertScore(user.id, 0);

    req.session.userId = user.id;
    req.session.name = user.name;
    req.session.role = user.role;
    res.redirect('/student/dashboard');
  } catch (err) {
    console.error('Register error:', err);
    res.render('auth/register', { error: 'Registration failed. Please try again.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ─────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────

app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const topics = await db.getAllTopics();
    const leaderboard = await db.getLeaderboard(10);
    res.render('admin/dashboard', { topics, leaderboard });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load dashboard.' });
  }
});

// Topics CRUD
app.get('/admin/topics/new', requireAdmin, (req, res) => {
  res.render('admin/topic-form', { topic: null, error: null });
});

app.post('/admin/topics', requireAdmin, async (req, res) => {
  const { title, summary_text, podcast_url } = req.body;
  try {
    await db.createTopic({ title, summary_text, podcast_url });
    res.redirect('/admin/dashboard');
  } catch (err) {
    res.render('admin/topic-form', { topic: null, error: 'Failed to create topic.' });
  }
});

app.get('/admin/topics/:id/edit', requireAdmin, async (req, res) => {
  try {
    const topic = await db.getTopicById(req.params.id);
    res.render('admin/topic-form', { topic, error: null });
  } catch {
    res.redirect('/admin/dashboard');
  }
});

app.put('/admin/topics/:id', requireAdmin, async (req, res) => {
  const { title, summary_text, podcast_url } = req.body;
  try {
    await db.updateTopic(req.params.id, { title, summary_text, podcast_url });
    res.redirect('/admin/dashboard');
  } catch {
    res.redirect('/admin/dashboard');
  }
});

app.delete('/admin/topics/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteTopic(req.params.id);
    res.redirect('/admin/dashboard');
  } catch {
    res.redirect('/admin/dashboard');
  }
});

// Questions CRUD
app.get('/admin/topics/:topicId/questions', requireAdmin, async (req, res) => {
  try {
    const topic = await db.getTopicById(req.params.topicId);
    const questions = await db.getQuestionsByTopic(req.params.topicId);
    res.render('admin/questions', { topic, questions });
  } catch (err) {
    res.render('error', { message: 'Failed to load questions.' });
  }
});

app.get('/admin/topics/:topicId/questions/new', requireAdmin, async (req, res) => {
  const topic = await db.getTopicById(req.params.topicId);
  res.render('admin/question-form', { topic, question: null, error: null });
});

app.post('/admin/topics/:topicId/questions', requireAdmin, async (req, res) => {
  const { type, text, options, correct_answer, rubric, keywords, points } = req.body;
  try {
    let parsedOptions = null;
    if (type === 'mcq' && options) {
      parsedOptions = options.split('\n').map(o => o.trim()).filter(Boolean);
    }
    const parsedKeywords = keywords
      ? keywords.split(',').map(k => k.trim()).filter(Boolean)
      : [];

    await db.createQuestion({
      topic_id: req.params.topicId,
      type,
      text,
      options: parsedOptions,
      correct_answer,
      rubric,
      keywords: parsedKeywords,
      points: parseInt(points) || 10
    });
    res.redirect(`/admin/topics/${req.params.topicId}/questions`);
  } catch (err) {
    console.error(err);
    const topic = await db.getTopicById(req.params.topicId);
    res.render('admin/question-form', { topic, question: null, error: 'Failed to create question.' });
  }
});

app.delete('/admin/questions/:id', requireAdmin, async (req, res) => {
  try {
    const q = await db.getQuestionById(req.params.id);
    await db.deleteQuestion(req.params.id);
    res.redirect(`/admin/topics/${q.topic_id}/questions`);
  } catch {
    res.redirect('/admin/dashboard');
  }
});

// ─────────────────────────────────────────────
// STUDENT ROUTES
// ─────────────────────────────────────────────

app.get('/student/dashboard', requireStudent, async (req, res) => {
  try {
    const topics = await db.getAllTopics();
    const score = await db.getScoreByUser(req.session.userId);
    const leaderboard = await db.getLeaderboard(10);
    res.render('student/dashboard', { topics, score, leaderboard });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load student dashboard.' });
  }
});

// View Topic Summary
app.get('/student/topics/:id', requireStudent, async (req, res) => {
  try {
    const topic = await db.getTopicById(req.params.id);
    const questions = await db.getQuestionsByTopic(req.params.id);
    res.render('student/topic', { topic, questions });
  } catch {
    res.redirect('/student/dashboard');
  }
});

// Practice Questions
app.get('/student/topics/:topicId/practice', requireStudent, async (req, res) => {
  try {
    const topic = await db.getTopicById(req.params.topicId);
    const questions = await db.getQuestionsByTopic(req.params.topicId);
    res.render('student/practice', { topic, questions, results: null });
  } catch {
    res.redirect('/student/dashboard');
  }
});

app.post('/student/topics/:topicId/practice', requireStudent, async (req, res) => {
  try {
    const topic = await db.getTopicById(req.params.topicId);
    const questions = await db.getQuestionsByTopic(req.params.topicId);
    const answers = req.body; // { question_<id>: <answer> }
    let totalEarned = 0;
    const results = [];

    for (const q of questions) {
      const studentAnswer = answers[`question_${q.id}`] || '';

      if (q.type === 'mcq' || q.type === 'tf') {
        // Instant grading
        const correct = studentAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
        const earned = correct ? (q.points || 10) : 0;
        totalEarned += earned;
        results.push({
          question: q,
          studentAnswer,
          score: earned,
          maxScore: q.points || 10,
          feedback: correct ? '✓ Correct!' : `✗ Incorrect. The correct answer is: ${q.correct_answer}`,
          ai_feedback: null,
          correct
        });
        await db.saveAnswer({ user_id: req.session.userId, question_id: q.id, answer_text: studentAnswer, score: earned, ai_feedback: null });

      } else if (q.type === 'open') {
        // AI grading
        if (!studentAnswer.trim()) {
          results.push({ question: q, studentAnswer, score: 0, maxScore: q.points || 10, feedback: 'No answer provided.', ai_feedback: null, correct: false });
          continue;
        }
        const aiResult = await gradeOpenAnswer({
          questionText: q.text,
          rubric: q.rubric || 'Grade based on accuracy and completeness.',
          keywords: q.keywords || [],
          studentAnswer,
          maxPoints: q.points || 10
        });
        totalEarned += aiResult.score;
        const feedbackText = `${aiResult.feedback}${aiResult.missing_concepts?.length ? ` Missing concepts: ${aiResult.missing_concepts.join(', ')}.` : ''}`;
        results.push({
          question: q,
          studentAnswer,
          score: aiResult.score,
          maxScore: q.points || 10,
          feedback: feedbackText,
          ai_feedback: aiResult,
          correct: aiResult.score >= Math.floor((q.points || 10) * 0.7)
        });
        await db.saveAnswer({ user_id: req.session.userId, question_id: q.id, answer_text: studentAnswer, score: aiResult.score, ai_feedback: feedbackText });
      }
    }

    // Update total score
    if (totalEarned > 0) {
      await db.upsertScore(req.session.userId, totalEarned);
    }

    res.render('student/practice', { topic, questions, results, totalEarned });
  } catch (err) {
    console.error('Practice submission error:', err);
    res.render('error', { message: 'Error submitting answers. Please try again.' });
  }
});

// Pseudo-code Workspace
app.get('/student/workspace', requireStudent, (req, res) => {
  res.render('student/workspace', { review: null, error: null });
});

app.post('/student/workspace/review', requireStudent, async (req, res) => {
  const { algorithmName, pseudocode } = req.body;
  try {
    if (!pseudocode || pseudocode.trim().length < 10) {
      return res.render('student/workspace', { review: null, error: 'Please enter your pseudo-code before requesting a review.' });
    }
    const review = await reviewPseudocode({ algorithmName, pseudocode });
    res.render('student/workspace', { review, error: null, algorithmName, pseudocode });
  } catch (err) {
    console.error('Workspace review error:', err);
    res.render('student/workspace', { review: null, error: 'AI review failed. Please try again.', algorithmName, pseudocode });
  }
});

// Leaderboard
app.get('/leaderboard', requireLogin, async (req, res) => {
  try {
    const leaderboard = await db.getLeaderboard(20);
    const myScore = await db.getScoreByUser(req.session.userId);
    res.render('leaderboard', { leaderboard, myScore });
  } catch {
    res.render('error', { message: 'Could not load leaderboard.' });
  }
});

// Error page
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

// ─────────────────────────────────────────────
// Export for Vercel
// ─────────────────────────────────────────────
module.exports = app;

// Local dev
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`StudyAI running on http://localhost:${PORT}`));
}
module.exports = app;