const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const {
  createQuiz, getAllQuizzes, getQuiz, updateQuiz, deleteQuiz,
  publishQuiz, assignStudents,
  getAvailableQuizzes, getUpcomingQuizzes, getCompletedQuizzes, getPracticeQuizzes,
  startQuiz, saveAnswer, submitQuiz,
  getStudentResults, getResultDetail,
  getAttemptStatus
} = require('../controllers/quizController');

// ─── Admin ────────────────────────────────────────────────────────────────────
router.post('/',              protectAdmin, createQuiz);
router.get('/admin',          protectAdmin, getAllQuizzes);
router.get('/admin/:id',      protectAdmin, getQuiz);
router.put('/:id',            protectAdmin, updateQuiz);
router.delete('/:id',         protectAdmin, deleteQuiz);
router.put('/:id/publish',    protectAdmin, publishQuiz);
router.put('/:id/assign',     protectAdmin, assignStudents);

// ─── Student ──────────────────────────────────────────────────────────────────
router.get('/available',      protect, getAvailableQuizzes);
router.get('/upcoming',       protect, getUpcomingQuizzes);
router.get('/completed',      protect, getCompletedQuizzes);
router.get('/practice',       protect, getPracticeQuizzes);
router.get('/my-results',     protect, getStudentResults);
router.get('/results/:id',    protect, getResultDetail);
router.get('/:id/attempt-status', protect, getAttemptStatus);
router.post('/:id/start',     protect, startQuiz);
router.put('/attempt/:attemptId/answer',  protect, saveAnswer);
router.post('/attempt/:attemptId/submit', protect, submitQuiz);

module.exports = router;
