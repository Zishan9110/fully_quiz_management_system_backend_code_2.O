const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const Result = require('../models/Result');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');

router.get('/admin', protectAdmin, asyncHandler(async (req, res) => {
  const { quizId, studentId, page = 1, limit = 20 } = req.query;
  const query = {};
  if (quizId) query.quiz = quizId;
  if (studentId) query.student = studentId;
  const total = await Result.countDocuments(query);
  const results = await Result.find(query)
    .populate('student', 'firstName lastName email')
    .populate('quiz', 'title type totalMarks')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit).limit(Number(limit));
  res.json({ success: true, total, data: results });
}));

router.put('/admin/:id/publish', protectAdmin, asyncHandler(async (req, res, next) => {
  const result = await Result.findByIdAndUpdate(req.params.id, { isPublished: true, publishedAt: new Date() }, { new: true });
  if (!result) return next(new ErrorResponse('Result not found', 404));
  res.json({ success: true, data: result });
}));

module.exports = router;
