const gemini = require('../ai/geminiService');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');

// @desc  Generate questions using Gemini AI
exports.generateQuestions = asyncHandler(async (req, res, next) => {
  const { topic, subject, count = 5, difficulty = 'medium', type = 'single_choice', language = 'English' } = req.body;
  if (!topic) return next(new ErrorResponse('Topic is required', 400));
  if (count > 20) return next(new ErrorResponse('Maximum 20 questions per request', 400));

  const questions = await gemini.generateQuestions({ topic, subject, count, difficulty, type, language });
  res.json({ success: true, count: questions.length, data: questions });
});

// @desc  Generate a complete quiz with Gemini AI
exports.generateQuiz = asyncHandler(async (req, res, next) => {
  const { topic, subject, title, questionCounts, difficulty, duration } = req.body;
  if (!topic) return next(new ErrorResponse('Topic is required', 400));

  const quiz = await gemini.generateQuiz({ topic, subject, title, questionCounts, difficulty, duration });
  res.json({ success: true, data: quiz });
});

// @desc  Analyze difficulty of quiz questions
exports.analyzeDifficulty = asyncHandler(async (req, res, next) => {
  const { quizId, questions: rawQuestions } = req.body;

  let questions = rawQuestions;
  if (quizId) {
    questions = await Question.find({ quiz: quizId }).select('text type marks difficulty');
  }
  if (!questions || questions.length === 0) return next(new ErrorResponse('No questions provided', 400));

  const analysis = await gemini.analyzeDifficulty(questions);
  res.json({ success: true, data: analysis });
});

// @desc  Suggest new questions based on existing quiz content
exports.suggestQuestions = asyncHandler(async (req, res, next) => {
  const { quizId, topic, count = 3 } = req.body;
  if (!topic) return next(new ErrorResponse('Topic is required', 400));

  let existingQuestions = [];
  if (quizId) {
    existingQuestions = await Question.find({ quiz: quizId }).select('text type');
  }

  const suggestions = await gemini.suggestQuestions(existingQuestions, topic, count);
  res.json({ success: true, data: suggestions });
});

// @desc  Improve a specific question
exports.improveQuestion = asyncHandler(async (req, res, next) => {
  const { questionId, questionText, questionType, options } = req.body;

  let question = { text: questionText, type: questionType, options };
  if (questionId) {
    question = await Question.findById(questionId);
    if (!question) return next(new ErrorResponse('Question not found', 404));
  }
  if (!question.text) return next(new ErrorResponse('Question text required', 400));

  const improved = await gemini.improveQuestion(question);
  res.json({ success: true, data: improved });
});

// @desc  Generate AI feedback for a student result
exports.generateFeedback = asyncHandler(async (req, res, next) => {
  const { resultId } = req.params;
  const Result = require('../models/Result');
  const result = await Result.findById(resultId);
  if (!result) return next(new ErrorResponse('Result not found', 404));

  const feedback = await gemini.generateStudentFeedback(result);
  res.json({ success: true, data: { feedback } });
});

// @desc  Check AI availability
exports.checkStatus = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      available: gemini.isReady,
      model: 'gemini-2.5-flash',
      features: ['generateQuestions', 'generateQuiz', 'analyzeDifficulty', 'suggestQuestions', 'improveQuestion', 'generateFeedback']
    }
  });
});
