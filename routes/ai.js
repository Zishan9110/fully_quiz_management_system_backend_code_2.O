const express = require('express');
const router = express.Router();
const { protectAdmin, protect } = require('../middleware/auth');
const {
  generateQuestions, generateQuiz, analyzeDifficulty,
  suggestQuestions, improveQuestion, generateFeedback, checkStatus
} = require('../controllers/aiController');

// Status check (admin)
router.get('/status', protectAdmin, checkStatus);

// Admin AI features
router.post('/generate-questions',  protectAdmin, generateQuestions);
router.post('/generate-quiz',       protectAdmin, generateQuiz);
router.post('/difficulty-analysis', protectAdmin, analyzeDifficulty);
router.post('/suggest-questions',   protectAdmin, suggestQuestions);
router.post('/improve-question',    protectAdmin, improveQuestion);

// Student feedback (protected)
router.get('/feedback/:resultId', protect, generateFeedback);

module.exports = router;
