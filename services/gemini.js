// services/gemini.js — Gemini 2.0 Flash integration
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

// ─────────────────────────────────────────────
// Grade an open-ended student answer
// ─────────────────────────────────────────────
async function gradeOpenAnswer({ questionText, rubric, keywords = [], studentAnswer, maxPoints = 10 }) {
  const model = getModel();

  const keywordList = keywords.length > 0
    ? `Required technical keywords (student should use most of these): ${keywords.join(', ')}`
    : 'No specific keywords required.';

  const prompt = `
You are a strict but fair academic grader for an AI Fundamentals course at FAU (FAU Erlangen-Nürnberg).

QUESTION:
${questionText}

GRADING RUBRIC:
${rubric}

${keywordList}

STUDENT ANSWER:
${studentAnswer}

INSTRUCTIONS:
1. Evaluate the student answer against the rubric and keyword coverage.
2. Assign a score from 0 to ${maxPoints} (integers only).
3. Provide concise, constructive feedback (3–5 sentences) explaining the score.
4. Identify any missing key concepts.

Respond ONLY in this exact JSON format (no markdown fences):
{
  "score": <integer 0-${maxPoints}>,
  "feedback": "<3-5 sentence feedback>",
  "missing_concepts": ["<concept1>", "<concept2>"]
}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    // Fallback if JSON parse fails
    return { score: 0, feedback: 'AI grading encountered an error. Please contact your instructor.', missing_concepts: [] };
  }
}

// ─────────────────────────────────────────────
// Review pseudo-code / algorithm logic
// ─────────────────────────────────────────────
async function reviewPseudocode({ algorithmName, pseudocode }) {
  const model = getModel();

  const prompt = `
You are an expert AI/CS instructor reviewing a student's pseudo-code for an AI Fundamentals course at FAU.

ALGORITHM: ${algorithmName || 'Unknown / General'}

STUDENT PSEUDO-CODE:
\`\`\`
${pseudocode}
\`\`\`

Please analyze the pseudo-code and provide:
1. **Logical Flow Assessment** — Is the overall algorithm structure correct?
2. **Step-by-Step Analysis** — Walk through each major step and note correctness.
3. **Issues Found** — List any logical errors, missing steps, or incorrect assumptions.
4. **Improvements** — Suggest specific improvements.
5. **Score** — Rate the pseudo-code quality: Excellent / Good / Needs Work / Incomplete.

Use clear, academic English. Be encouraging but precise. Format your response using markdown with the sections above as headers.
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { gradeOpenAnswer, reviewPseudocode };
