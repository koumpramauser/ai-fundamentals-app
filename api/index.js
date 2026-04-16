const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

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

// ── Auth middleware: decode JWT cookie → req.user + res.locals.sessionUser ──
app.use((req, res, next) => {
    const token = req.cookies && req.cookies.auth_token;
    res.locals.sessionUser = null;
    res.locals.title = 'StudyAI - FAU';
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

// ── REDIRECTS ──
app.get('/', (req, res) => res.redirect('/auth/login'));
app.get('/login', (req, res) => res.redirect('/auth/login'));
app.get('/register', (req, res) => res.redirect('/auth/register'));
app.get('/logout', (req, res) => res.redirect('/auth/logout'));

// ── LOGIN ──
app.get('/auth/login', (req, res) => {
    if (req.user) return res.redirect('/student/dashboard');
    res.render('auth/login', { error: null, message: null });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await supabase
            .from('users').select('*').eq('email', email).single();

        if (error || !user)
            return res.render('auth/login', { error: 'No account found with that email.', message: null });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.render('auth/login', { error: 'Incorrect password. Please try again.', message: null });

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error('Login error:', err);
        res.render('auth/login', { error: 'Something went wrong. Please try again.', message: null });
    }
});

// ── LOGOUT ──
app.get('/auth/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.redirect('/auth/login');
});

// ── REGISTER ──
app.get('/auth/register', (req, res) => {
    if (req.user) return res.redirect('/student/dashboard');
    res.render('auth/register', { error: null });
});

app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || name.trim().length < 2)
        return res.render('auth/register', { error: 'Please enter your full name.' });
    if (!password || password.length < 8)
        return res.render('auth/register', { error: 'Password must be at least 8 characters.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { data: newUser, error } = await supabase
            .from('users')
            .insert([{ name: name.trim(), email, password: hashedPassword, role: 'student' }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505')
                return res.render('auth/register', { error: 'An account with this email already exists.' });
            throw error;
        }

        // Create a score row for the new user
        await supabase.from('scores').insert([{ user_id: newUser.id, total_points: 0 }]);

        res.render('auth/login', { error: null, message: 'Account created! You can now sign in.' });
    } catch (err) {
        console.error('Register error:', err);
        res.render('auth/register', { error: 'Registration failed. Please try again.' });
    }
});

// ── STUDENT DASHBOARD ──
app.get('/student/dashboard', requireAuth, async (req, res) => {
    try {
        const [topicsRes, scoreRes, leaderboardRes] = await Promise.all([
            supabase.from('topics').select('*').order('created_at', { ascending: true }),
            supabase.from('scores').select('total_points').eq('user_id', req.user.id).single(),
            supabase.from('scores').select('total_points, users(id, name)').order('total_points', { ascending: false }).limit(10)
        ]);

        res.render('student/dashboard', {
            title: 'Dashboard',
            topics: topicsRes.data || [],
            score: scoreRes.data || { total_points: 0 },
            leaderboard: leaderboardRes.data || []
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.render('student/dashboard', {
            title: 'Dashboard',
            topics: [],
            score: { total_points: 0 },
            leaderboard: []
        });
    }
});

// ── 404 ──
app.use((req, res) => res.status(404).render('error', {
    message: 'Page Not Found',
    error: { status: 404 },
    sessionUser: res.locals.sessionUser
}));

module.exports = app;