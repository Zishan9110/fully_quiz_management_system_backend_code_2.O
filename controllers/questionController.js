const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');

exports.addQuestion = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) return next(new ErrorResponse('Quiz not found', 404));

  const question = await Question.create({ ...req.body, quiz: quiz._id });
  await Quiz.findByIdAndUpdate(quiz._id, {
    $push: { questions: question._id },
    $inc: { totalMarks: question.marks }
  });
  res.status(201).json({ success: true, data: question });
});

exports.bulkAddQuestions = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) return next(new ErrorResponse('Quiz not found', 404));

  const questions = req.body.questions.map((q, i) => ({ ...q, quiz: quiz._id, order: i }));
  const created = await Question.insertMany(questions);
  const totalMarks = created.reduce((sum, q) => sum + q.marks, 0);

  await Quiz.findByIdAndUpdate(quiz._id, {
    $push: { questions: { $each: created.map(q => q._id) } },
    $inc: { totalMarks }
  });
  res.status(201).json({ success: true, data: created });
});

exports.updateQuestion = asyncHandler(async (req, res, next) => {
  const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!question) return next(new ErrorResponse('Question not found', 404));
  res.json({ success: true, data: question });
});

exports.deleteQuestion = asyncHandler(async (req, res, next) => {
  const question = await Question.findById(req.params.id);
  if (!question) return next(new ErrorResponse('Question not found', 404));
  await Quiz.findByIdAndUpdate(question.quiz, {
    $pull: { questions: question._id },
    $inc: { totalMarks: -question.marks }
  });
  await question.deleteOne();
  res.json({ success: true, message: 'Question deleted' });
});

exports.getQuizQuestions = asyncHandler(async (req, res) => {
  const questions = await Question.find({ quiz: req.params.quizId }).sort({ order: 1 });
  res.json({ success: true, data: questions });
});
