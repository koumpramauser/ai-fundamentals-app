const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { gradeOpenAnswer, reviewPseudocode } = require('../services/gemini');
const { markdownToHtml } = require('../helpers/markdown');

dotenv.config();

const JWT_SECRET = process.env.SESSION_SECRET || 'fau-ai-study-secret';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) app.use(express.static(publicDir));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Auth middleware ──
app.use((req, res, next) => {
    const token = req.cookies && req.cookies.auth_token;
    res.locals.sessionUser = null;
    res.locals.title = 'StudyAI - FAU';
    res.locals.markdownToHtml = markdownToHtml;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            res.locals.sessionUser = decoded;
            req.user = decoded;
        } catch (e) {
            res.clearCookie('auth_token');
        }
    }
    next();
});

function requireAuth(req, res, next) {
    if (!req.user) return res.redirect('/auth/login');
    next();
}
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
    next();
}

// ── Redirects ──
app.get('/', (req, res) => res.redirect('/student/dashboard'));
app.get('/login', (req, res) => res.redirect('/auth/login'));
app.get('/register', (req, res) => res.redirect('/auth/register'));
app.get('/logout', (req, res) => res.redirect('/auth/logout'));

// ════════════════════════════════════
// AUTH
// ════════════════════════════════════
app.get('/auth/login', (req, res) => {
    if (req.user) return res.redirect('/student/dashboard');
    res.render('auth/login', { error: null, message: null });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
        if (error || !user) return res.render('auth/login', { error: 'No account found with that email.', message: null });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.render('auth/login', { error: 'Incorrect password. Please try again.', message: null });

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET, { expiresIn: '7d' }
        );
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
    } catch (err) {
        console.error('Login error:', err);
        res.render('auth/login', { error: 'Something went wrong. Please try again.', message: null });
    }
});

app.get('/auth/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.redirect('/auth/login');
});

app.get('/auth/register', (req, res) => {
    if (req.user) return res.redirect('/student/dashboard');
    res.render('auth/register', { error: null });
});

app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || name.trim().length < 2) return res.render('auth/register', { error: 'Please enter your full name.' });
    if (!password || password.length < 8) return res.render('auth/register', { error: 'Password must be at least 8 characters.' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { data: newUser, error } = await supabase
            .from('users').insert([{ name: name.trim(), email, password: hashedPassword, role: 'student' }])
            .select().single();
        if (error) {
            if (error.code === '23505') return res.render('auth/register', { error: 'An account with this email already exists.' });
            throw error;
        }
        await supabase.from('scores').insert([{ user_id: newUser.id, total_points: 0 }]);
        res.render('auth/login', { error: null, message: 'Account created! You can now sign in.' });
    } catch (err) {
        console.error('Register error:', err);
        res.render('auth/register', { error: 'Registration failed. Please try again.' });
    }
});

// ════════════════════════════════════
// STUDENT — DASHBOARD
// ════════════════════════════════════
app.get('/student/dashboard', async (req, res) => {
    try {
        const queries = [
            supabase.from('topics').select('*').order('created_at', { ascending: true }),
            supabase.from('scores').select('total_points, users(id, name)').order('total_points', { ascending: false }).limit(10)
        ];
        if (req.user) {
            queries.push(supabase.from('scores').select('total_points').eq('user_id', req.user.id).single());
        }
        const results = await Promise.all(queries);
        res.render('student/dashboard', {
            title: 'Dashboard',
            topics: results[0].data || [],
            leaderboard: results[1].data || [],
            score: req.user ? (results[2]?.data || { total_points: 0 }) : { total_points: 0 }
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.render('student/dashboard', { title: 'Dashboard', topics: [], score: { total_points: 0 }, leaderboard: [] });
    }
});

// ════════════════════════════════════
// STUDENT — TOPIC (Read Summary)
// ════════════════════════════════════
app.get('/student/topics/:id', async (req, res) => {
    try {
        const { data: topic, error } = await supabase.from('topics').select('*').eq('id', req.params.id).single();
        if (error || !topic) return res.redirect('/student/dashboard');
        const { data: questions } = await supabase.from('questions').select('id, type, points').eq('topic_id', req.params.id);
        res.render('student/topic', { title: topic.title, topic, questions: questions || [] });
    } catch (err) {
        console.error('Topic error:', err);
        res.redirect('/student/dashboard');
    }
});

// ════════════════════════════════════
// STUDENT — PRACTICE
// ════════════════════════════════════
app.get('/student/topics/:id/practice', async (req, res) => {
    try {
        const { data: topic } = await supabase.from('topics').select('*').eq('id', req.params.id).single();
        if (!topic) return res.redirect('/student/dashboard');
        const { data: questions } = await supabase.from('questions').select('*').eq('topic_id', req.params.id);
        res.render('student/practice', {
            title: 'Practice: ' + topic.title,
            topic,
            questions: questions || [],
            results: null,
            totalEarned: 0
        });
    } catch (err) {
        console.error('Practice GET error:', err);
        res.redirect('/student/dashboard');
    }
});

app.post('/student/topics/:id/practice', requireAuth, async (req, res) => {
    try {
        const { data: topic } = await supabase.from('topics').select('*').eq('id', req.params.id).single();
        const { data: questions } = await supabase.from('questions').select('*').eq('topic_id', req.params.id);
        if (!topic || !questions) return res.redirect('/student/dashboard');

        let totalEarned = 0;
        const results = [];

        for (const q of questions) {
            const studentAnswer = req.body[`question_${q.id}`] || '';
            let score = 0;
            let feedback = '';
            let ai_feedback = null;

            if (q.type === 'mcq' || q.type === 'tf') {
                const isCorrect = studentAnswer.toString().toLowerCase() === q.correct_answer.toString().toLowerCase();
                score = isCorrect ? (q.points || 10) : 0;
                feedback = isCorrect ? 'Correct!' : `Incorrect. The correct answer was: ${q.correct_answer}`;
            } else if (q.type === 'open') {
                const grading = await gradeOpenAnswer({
                    questionText: q.text,
                    rubric: q.rubric || 'Grade based on completeness and accuracy.',
                    keywords: q.keywords || [],
                    studentAnswer,
                    maxPoints: q.points || 10
                });
                score = grading.score;
                feedback = grading.feedback;
                ai_feedback = grading;
            }

            totalEarned += score;
            results.push({ question: q, studentAnswer, score, maxScore: q.points || 10, feedback, ai_feedback, correct: score === (q.points || 10) });

            // Save answer
            await supabase.from('answers').insert([{
                user_id: req.user.id,
                question_id: q.id,
                answer_text: studentAnswer,
                score,
                ai_feedback: ai_feedback ? JSON.stringify(ai_feedback) : null
            }]);
        }

        // Update score
        const { data: existing } = await supabase.from('scores').select('total_points').eq('user_id', req.user.id).single();
        const newTotal = (existing?.total_points || 0) + totalEarned;
        await supabase.from('scores').upsert([{ user_id: req.user.id, total_points: newTotal, last_updated: new Date().toISOString() }]);

        res.render('student/practice', { title: 'Practice Results', topic, questions, results, totalEarned });
    } catch (err) {
        console.error('Practice POST error:', err);
        res.redirect('/student/dashboard');
    }
});

// ════════════════════════════════════
// STUDENT — WORKSPACE
// ════════════════════════════════════
app.get('/student/workspace', (req, res) => {
    res.render('student/workspace', { title: 'Pseudo-code Workspace', review: null, error: null, algorithmName: null, pseudocode: null });
});

app.post('/student/workspace/review', async (req, res) => {
    const { algorithmName, pseudocode } = req.body;
    if (!pseudocode || pseudocode.trim().length < 10) {
        return res.render('student/workspace', { title: 'Pseudo-code Workspace', review: null, error: 'Please enter your pseudo-code before requesting a review.', algorithmName, pseudocode });
    }
    try {
        const review = await reviewPseudocode({ algorithmName, pseudocode });
        res.render('student/workspace', { title: 'Pseudo-code Workspace', review, error: null, algorithmName, pseudocode });
    } catch (err) {
        console.error('Workspace Gemini error:', err?.message || err);
        let errorMsg = 'AI review failed. Please try again.';
        if (err?.message?.includes('429') || err?.message?.includes('quota')) {
            errorMsg = 'AI is currently busy (rate limit reached). Please wait a moment and try again.';
        } else if (err?.message?.includes('API_KEY') || err?.message?.includes('403')) {
            errorMsg = 'AI service configuration error. Please contact the administrator.';
        }
        res.render('student/workspace', { title: 'Pseudo-code Workspace', review: null, error: errorMsg, algorithmName, pseudocode });
    }
});

// ════════════════════════════════════
// LEADERBOARD
// ════════════════════════════════════
app.get('/leaderboard', async (req, res) => {
    try {
        const queries = [
            supabase.from('scores').select('total_points, last_updated, users(id, name)').order('total_points', { ascending: false }).limit(50)
        ];
        if (req.user) {
            queries.push(supabase.from('scores').select('total_points').eq('user_id', req.user.id).single());
        }
        const results = await Promise.all(queries);
        res.render('leaderboard', {
            title: 'Leaderboard',
            leaderboard: results[0].data || [],
            myScore: req.user ? (results[1]?.data || { total_points: 0 }) : { total_points: 0 }
        });
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.render('leaderboard', { title: 'Leaderboard', leaderboard: [], myScore: { total_points: 0 } });
    }
});

// ════════════════════════════════════
// ADMIN
// ════════════════════════════════════
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
    try {
        const [topicsRes, usersRes, scoresRes] = await Promise.all([
            supabase.from('topics').select('*').order('created_at', { ascending: true }),
            supabase.from('users').select('id, name, email, role, created_at').order('created_at', { ascending: false }),
            supabase.from('scores').select('total_points, users(id, name)').order('total_points', { ascending: false }).limit(10)
        ]);
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            topics: topicsRes.data || [],
            users: usersRes.data || [],
            leaderboard: scoresRes.data || []
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.render('admin/dashboard', { title: 'Admin Dashboard', topics: [], users: [], leaderboard: [] });
    }
});

app.get('/admin/topics/new', requireAdmin, (req, res) => {
    res.render('admin/topic-form', { title: 'New Topic', topic: null, error: null });
});

app.post('/admin/topics', requireAdmin, async (req, res) => {
    const { title, summary_text, podcast_url } = req.body;
    try {
        const { error } = await supabase.from('topics').insert([{ title, summary_text, podcast_url: podcast_url || null }]);
        if (error) throw error;
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error('Topic create error:', err);
        res.render('admin/topic-form', { title: 'New Topic', topic: null, error: 'Failed to create topic.' });
    }
});

app.get('/admin/topics/:id/edit', requireAdmin, async (req, res) => {
    const { data: topic } = await supabase.from('topics').select('*').eq('id', req.params.id).single();
    res.render('admin/topic-form', { title: 'Edit Topic', topic, error: null });
});

app.post('/admin/topics/:id', requireAdmin, async (req, res) => {
    const { title, summary_text, podcast_url } = req.body;
    await supabase.from('topics').update({ title, summary_text, podcast_url: podcast_url || null }).eq('id', req.params.id);
    res.redirect('/admin/dashboard');
});

app.post('/admin/topics/:id/delete', requireAdmin, async (req, res) => {
    await supabase.from('topics').delete().eq('id', req.params.id);
    res.redirect('/admin/dashboard');
});

app.get('/admin/topics/:id/questions', requireAdmin, async (req, res) => {
    const { data: topic } = await supabase.from('topics').select('*').eq('id', req.params.id).single();
    const { data: questions } = await supabase.from('questions').select('*').eq('topic_id', req.params.id);
    res.render('admin/questions', { title: 'Questions', topic, questions: questions || [] });
});

app.get('/admin/topics/:id/questions/new', requireAdmin, async (req, res) => {
    const { data: topic } = await supabase.from('topics').select('*').eq('id', req.params.id).single();
    res.render('admin/question-form', { title: 'New Question', topic, question: null, error: null });
});

app.post('/admin/topics/:id/questions', requireAdmin, async (req, res) => {
    const { type, text, options, correct_answer, rubric, keywords, points } = req.body;
    const { data: topic } = await supabase.from('topics').select('*').eq('id', req.params.id).single();
    try {
        const parsedOptions = options ? options.split('\n').map(o => o.trim()).filter(Boolean) : null;
        const parsedKeywords = keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : null;
        const { error } = await supabase.from('questions').insert([{
            topic_id: req.params.id, type, text,
            options: parsedOptions,
            correct_answer: correct_answer || null,
            rubric: rubric || null,
            keywords: parsedKeywords,
            points: parseInt(points) || 10
        }]);
        if (error) throw error;
        res.redirect(`/admin/topics/${req.params.id}/questions`);
    } catch (err) {
        console.error('Question create error:', err);
        res.render('admin/question-form', { title: 'New Question', topic, question: null, error: 'Failed to save question.' });
    }
});

app.post('/admin/questions/:id/delete', requireAdmin, async (req, res) => {
    const { data: question } = await supabase.from('questions').select('topic_id').eq('id', req.params.id).single();
    await supabase.from('questions').delete().eq('id', req.params.id);
    res.redirect(`/admin/topics/${question?.topic_id}/questions`);
});

// ── 404 ──
app.use((req, res) => res.status(404).render('error', {
    message: 'Page Not Found',
    error: { status: 404 },
    sessionUser: res.locals.sessionUser
}));

module.exports = app;