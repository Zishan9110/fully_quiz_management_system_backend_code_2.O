const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const { addQuestion, bulkAddQuestions, updateQuestion, deleteQuestion, getQuizQuestions } = require('../controllers/questionController');

router.get('/quiz/:quizId', protectAdmin, getQuizQuestions);
router.post('/quiz/:quizId', protectAdmin, addQuestion);
router.post('/quiz/:quizId/bulk', protectAdmin, bulkAddQuestions);
router.put('/:id', protectAdmin, updateQuestion);
router.delete('/:id', protectAdmin, deleteQuestion);
module.exports = router;
