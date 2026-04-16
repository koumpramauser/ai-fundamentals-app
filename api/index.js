const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    // Don't crash — let routes fail gracefully
}

// Supabase Bağlantısı
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Only serve static files if the public folder actually exists
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'fau-ai-study-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use((req, res, next) => {
    res.locals.sessionUser = (req.session && req.session.user) ? req.session.user : null;
    res.locals.title = 'StudyAI - FAU';
    next();
});

// --- ROTALAR ---
app.get('/', (req, res) => res.redirect('/auth/login'));
app.get('/login', (req, res) => res.redirect('/auth/login'));
app.get('/register', (req, res) => res.redirect('/auth/register'));

// LOGIN
app.get('/auth/login', (req, res) => res.render('auth/login', { error: null, message: null }));
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
        if (error || !user) return res.render('auth/login', { error: 'No account found with that email.', message: null });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.render('auth/login', { error: 'Incorrect password. Please try again.', message: null });

        req.session.user = { id: user.id, email: user.email, role: user.role };
        res.redirect('/student/dashboard');
    } catch (err) { res.render('auth/login', { error: 'Something went wrong. Please try again.', message: null }); }
});

// DASHBOARD (EKSİK OLAN ROTA BUYDU)
app.get('/student/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/auth/login');
    res.render('student/dashboard', { title: 'Dashboard' });
});

// REGISTER
app.get('/auth/register', (req, res) => res.render('auth/register', { error: null }));
app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!password || password.length < 8) {
        return res.render('auth/register', { error: 'Password must be at least 8 characters.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { error } = await supabase.from('users').insert([{ email, password: hashedPassword, role: 'student' }]);
        if (error) {
            if (error.code === '23505') return res.render('auth/register', { error: 'An account with this email already exists.' });
            throw error;
        }
        res.render('auth/login', { error: null, message: 'Account created! You can now sign in.' });
    } catch (err) { res.render('auth/register', { error: 'Registration failed. Please try again.' }); }
});

app.use((req, res) => res.status(404).render('error', { 
    message: 'Page Not Found', 
    error: {status:404}, 
    sessionUser: res.locals.sessionUser 
}));

module.exports = app;