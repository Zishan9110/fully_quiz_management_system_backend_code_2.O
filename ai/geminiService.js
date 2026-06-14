const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.isReady = false;
    this.init();
  }

  init() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not set — AI features disabled');
      return;
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
  model: 'gemini-2.5-flash'
});
    this.isReady = true;
  }

  checkReady() {
    if (!this.isReady) throw new Error('Gemini AI not configured. Set GEMINI_API_KEY in .env');
  }

  async generateQuestions({ topic, subject, count = 5, difficulty = 'medium', type = 'single_choice', language = 'English' }) {
    this.checkReady();

    const prompt = `Generate ${count} ${difficulty} level quiz questions about "${topic}" (subject: ${subject || topic}) in ${language}.

Question type: ${type}
${type === 'single_choice' || type === 'multiple_choice' ? 'Provide 4 options (A, B, C, D) with correct answer(s) marked.' : ''}
${type === 'true_false' ? 'Questions should be True/False only.' : ''}
${type === 'fill_blank' ? 'Create fill-in-the-blank questions with the correct answer.' : ''}
${type === 'short_answer' ? 'Create short answer questions with expected answers.' : ''}

Return ONLY a valid JSON array. No markdown, no explanation. Format:
[
  {
    "text": "Question text here?",
    "type": "${type}",
    "options": [
      {"text": "Option A", "isCorrect": false},
      {"text": "Option B", "isCorrect": true},
      {"text": "Option C", "isCorrect": false},
      {"text": "Option D", "isCorrect": false}
    ],
    "correctAnswer": "For fill_blank and short_answer only",
    "explanation": "Why this is correct",
    "marks": 1,
    "difficulty": "${difficulty}",
    "subject": "${subject || topic}",
    "topic": "${topic}"
  }
]`;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const questions = JSON.parse(cleaned);
    return questions;
  }

  async generateQuiz({ topic, subject, title, questionCounts, difficulty = 'mixed', duration = 30 }) {
    this.checkReady();

    const counts = questionCounts || { single_choice: 5, true_false: 2, fill_blank: 2, short_answer: 1 };

    const prompt = `Create a complete quiz titled "${title || `${topic} Quiz`}" about "${topic}".

Generate questions with this distribution:
${Object.entries(counts).map(([type, count]) => `- ${count} ${type} questions`).join('\n')}

Difficulty: ${difficulty}
Subject: ${subject || topic}

Return ONLY a valid JSON object:
{
  "title": "${title || topic + ' Quiz'}",
  "description": "Brief description of this quiz",
  "instructions": "Instructions for students",
  "estimatedDuration": ${duration},
  "questions": [
    {
      "text": "Question text",
      "type": "single_choice",
      "options": [
        {"text": "Option A", "isCorrect": false},
        {"text": "Option B", "isCorrect": true},
        {"text": "Option C", "isCorrect": false},
        {"text": "Option D", "isCorrect": false}
      ],
      "correctAnswer": null,
      "explanation": "Explanation",
      "marks": 1,
      "difficulty": "medium",
      "subject": "${subject || topic}"
    }
  ]
}`;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  }

  async analyzeDifficulty(questions) {
    this.checkReady();

    const prompt = `Analyze these quiz questions and classify each as easy, medium, or hard.
Consider: clarity, complexity, knowledge required, cognitive level.

Questions:
${questions.map((q, i) => `${i + 1}. [${q.type}] ${q.text}`).join('\n')}

Return ONLY valid JSON array:
[
  {"index": 0, "suggestedDifficulty": "easy", "reason": "brief reason", "cognitiveLevel": "recall"},
  ...
]`;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  }

  async suggestQuestions(existingQuestions, topic, count = 3) {
    this.checkReady();

    const existingSample = existingQuestions.slice(0, 5).map(q => q.text).join('\n');

    const prompt = `Based on these existing questions about "${topic}":
${existingSample}

Suggest ${count} NEW questions that:
- Cover different aspects not already tested
- Have varying difficulty levels
- Complement the existing questions

Return ONLY valid JSON array of question objects with same structure as before.`;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  }

  async improveQuestion(question) {
    this.checkReady();

    const prompt = `Improve this quiz question to make it clearer, more educational, and better structured:

Original question: ${question.text}
Type: ${question.type}
Current options: ${JSON.stringify(question.options || [])}

Return ONLY valid JSON with improved version:
{
  "text": "improved question text",
  "options": [...],
  "explanation": "better explanation",
  "improvements": "what was improved"
}`;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  }

  async generateStudentFeedback(result) {
    this.checkReady();

    const prompt = `A student completed a quiz with these results:
- Score: ${Math.round(result.percentage)}%
- Correct: ${result.correctAnswers}, Wrong: ${result.wrongAnswers}, Skipped: ${result.skippedAnswers}
- Subject analysis: ${JSON.stringify(result.subjectAnalysis || [])}
- Passed: ${result.isPassed}

Generate personalized, encouraging feedback (2-3 paragraphs) with:
1. Performance summary
2. Strengths identified
3. Areas to improve with study tips

Return plain text (no JSON).`;

    const res = await this.model.generateContent(prompt);
    return res.response.text();
  }
}

module.exports = new GeminiService();
