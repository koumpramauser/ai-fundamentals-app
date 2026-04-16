const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// --- View Engine Configuration ---
// Fixed the path for Vercel to find the views folder correctly
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');

// --- Standard Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Session Global Variables Middleware ---
// This ensures Navbar and other pages don't crash when checking for user session
app.use((req, res, next) => {
    res.locals.sessionUser = (req.session && req.session.user) ? req.session.user : null;
    next();
});

// --- Auth Check Middleware (requireLogin) ---
const requireLogin = (req, res, next) => {
    // If you have a real session logic, check it here
    // For now, it proceeds to avoid blocking you
    next();
};

// --- Routes ---

// 1. Home Route (Root) - Redirects to login to avoid 404
app.get('/', (req, res) => {
    res.redirect('/auth/login');
});

// 2. Authentication Routes
app.get('/auth/login', (req, res) => {
    res.render('auth/login', { 
        error: null, 
        message: null,
        title: 'Login'
    });
});

app.get('/auth/register', (req, res) => {
    res.render('auth/register', { 
        error: null,
        title: 'Register'
    });
});

// 3. Student Panel Routes
app.get('/student/dashboard', requireLogin, (req, res) => {
    res.render('student/dashboard', {
        title: 'Dashboard'
    });
});

app.get('/student/workspace', requireLogin, (req, res) => {
    res.render('student/workspace', { 
        review: null, 
        error: null,
        title: 'Workspace'
    });
});

// 4. Leaderboard Route
app.get('/leaderboard', requireLogin, async (req, res) => {
    try {
        // Integrate your Supabase/DB logic here
        res.render('leaderboard', { 
            leaderBoard: [], 
            myScore: 0,
            title: 'Leaderboard'
        });
    } catch (err) {
        res.status(500).render('error', { 
            message: 'Leaderboard could not be loaded.',
            error: err,
            user: null,
            title: 'Error'
        });
    }
});

// --- Error Handling ---

// 404 Handler
app.use((req, res) => {
    res.status(404).render('error', { 
        message: 'Page Not Found',
        error: { status: 404 },
        user: null,
        title: '404'
    });
});

// 500 Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: 'Something went wrong!',
        error: err,
        user: null,
        title: '500 Error'
    });
});

// --- Vercel Export ---
// Essential for Vercel serverless deployment
module.exports = app;

// --- Local Development ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`StudyAI is running locally at http://localhost:${PORT}`);
    });
}