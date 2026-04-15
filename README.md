# StudyAI: AI Fundamentals Edition
**FAU Erlangen-Nürnberg — Vercel + Supabase + Gemini 2.0 Flash**

---

## Project Structure

```
studyai/
├── api/
│   └── index.js              ← Vercel entry point (all Express routes)
├── data/
│   └── supabase.js           ← All DB logic (@supabase/supabase-js)
├── services/
│   └── gemini.js             ← Gemini 2.0 Flash: grading + code review
├── middleware/
│   └── auth.js               ← requireLogin / requireAdmin / requireStudent
├── helpers/
│   └── markdown.js           ← Lightweight markdown→HTML for EJS
├── views/
│   ├── partials/
│   │   ├── header.ejs        ← HTML head + global CSS
│   │   ├── navbar.ejs        ← Responsive top navigation
│   │   └── footer.ejs        ← Footer + closing tags
│   ├── auth/
│   │   ├── login.ejs
│   │   └── register.ejs
│   ├── admin/
│   │   ├── dashboard.ejs     ← Topic list + leaderboard preview
│   │   ├── topic-form.ejs    ← Create / edit topic
│   │   ├── questions.ejs     ← List questions per topic
│   │   └── question-form.ejs ← Add MCQ / TF / Open question
│   ├── student/
│   │   ├── dashboard.ejs     ← Topic cards + score + mini-leaderboard
│   │   ├── topic.ejs         ← Summary + podcast link
│   │   ├── practice.ejs      ← Quiz form + AI-graded results
│   │   └── workspace.ejs     ← Pseudo-code editor + AI review panel
│   ├── leaderboard.ejs
│   └── error.ejs
├── database/
│   └── schema.sql            ← Run once in Supabase SQL editor
├── .env.example
├── .gitignore
├── package.json
└── vercel.json
```

---

## Quick Start

### 1. Supabase Setup
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the entire contents of `database/schema.sql`
3. Copy your **Project URL** and **Service Role Key** from Settings → API

### 2. Gemini API Key
1. Visit [aistudio.google.com](https://aistudio.google.com)
2. Create an API key for **Gemini 2.0 Flash**

### 3. Local Development
```bash
git clone <your-repo>
cd studyai
npm install
cp .env.example .env
# Fill in your keys in .env
npm run dev
# → http://localhost:3000
```

Default admin login: `admin@fau.edu` / `Admin@FAU2024`
> ⚠️ Change the admin password immediately after first login by updating the bcrypt hash in `schema.sql` or via Supabase Table Editor.

### 4. Deploy to Vercel
```bash
npm install -g vercel
vercel login
vercel --prod
```

In the Vercel dashboard → **Environment Variables**, add:
| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |
| `GEMINI_API_KEY` | Your Gemini API key |
| `SESSION_SECRET` | A long random string |
| `NODE_ENV` | `production` |

---

## Key Features

### Admin Panel
- **Topics**: Create topics with rich bullet-point summaries and podcast URLs
- **Questions**: Add MCQ, True/False, and Open-ended questions per topic
- **Rubrics**: Define grading rubrics and required technical keywords for AI grading
- **Leaderboard**: Monitor top-performing students

### Student Dashboard
- **Learning Cards**: Browse topics, read summaries, listen to podcasts
- **Practice Mode**: Answer questions; MCQ/TF graded instantly, open-ended graded by Gemini
- **Pseudo-code Workspace**: Write algorithm logic (A*, Gradient Descent, etc.) and receive structured AI feedback
- **Leaderboard**: Real-time ranking by total points

### AI Grading (Gemini 2.0 Flash)
Open-ended answers are evaluated against:
1. The instructor-defined rubric
2. Required technical keywords (Learning Rate, Heuristics, etc.)

Returns: score (0–N), written feedback, and list of missing concepts.

### Pseudo-code Review
The workspace sends student code to Gemini with structured prompting for:
- Logical flow assessment
- Step-by-step analysis
- Issue identification
- Improvement suggestions
- Quality rating (Excellent / Good / Needs Work / Incomplete)

---

## Architecture Notes

| Decision | Rationale |
|----------|-----------|
| No `fs` / `db.json` | Vercel is read-only; all persistence via Supabase |
| No PDF parsing | Avoids `ENOENT` on serverless; admins paste summaries directly |
| Service Role Key (server-side) | Bypasses RLS for trusted server operations |
| EJS templates | Simple, zero-bundle server rendering |
| Method Override | Enables PUT/DELETE from HTML forms |
| bcryptjs (not bcrypt) | Pure JS, no native bindings needed on Vercel |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Students and admins with bcrypt passwords |
| `topics` | Study units with summary text and podcast URL |
| `questions` | MCQ / TF / Open questions with rubric and keywords |
| `scores` | One row per student, cumulative total points |
| `answers` | Full audit log of every submission with AI feedback |
