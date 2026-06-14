const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const Result = require('../models/Result');
const Notification = require('../models/Notification');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');

// ─── ADMIN ────────────────────────────────────────────────────────────────────

exports.createQuiz = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.admin._id;
  const quiz = await Quiz.create(req.body);
  res.status(201).json({ success: true, data: quiz });
});

exports.getAllQuizzes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, course, type, search } = req.query;
  const query = {};
  if (status) query.status = status;
  if (course) query.course = course;
  if (type)   query.type = type;
  if (search) query.title = { $regex: search, $options: 'i' };
  const total = await Quiz.countDocuments(query);
  const quizzes = await Quiz.find(query)
    .populate('course', 'name category')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: quizzes });
});

exports.getQuiz = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id)
    .populate('questions')
    .populate('course', 'name')
    .populate('createdBy', 'firstName lastName');
  if (!quiz) return next(new ErrorResponse('Quiz not found', 404));
  res.json({ success: true, data: quiz });
});

exports.updateQuiz = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!quiz) return next(new ErrorResponse('Quiz not found', 404));
  res.json({ success: true, data: quiz });
});

exports.deleteQuiz = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) return next(new ErrorResponse('Quiz not found', 404));
  await Question.deleteMany({ quiz: quiz._id });
  await quiz.deleteOne();
  res.json({ success: true, message: 'Quiz deleted' });
});

exports.publishQuiz = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id).populate('assignedTo');
  if (!quiz) return next(new ErrorResponse('Quiz not found', 404));
  quiz.status = 'published';
  await quiz.save();
  const notifications = quiz.assignedTo.map(student => ({
    recipient: student._id, recipientModel: 'User',
    type: 'quiz_assigned', title: 'New Quiz Available',
    message: `Quiz "${quiz.title}" is now available`,
    data: { quizId: quiz._id }, link: `/student/quizzes/${quiz._id}`
  }));
  if (notifications.length) await Notification.insertMany(notifications);
  // Emit via socket
  const { getIO } = require('../sockets');
  try {
    quiz.assignedTo.forEach(s => {
      getIO().to(`user_${s._id}`).emit('notification', { type: 'quiz_assigned', title: 'New Quiz Available', message: quiz.title });
    });
  } catch (_) {}
  res.json({ success: true, data: quiz });
});

exports.assignStudents = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { assignedTo: { $each: req.body.studentIds } } },
    { new: true }
  );
  if (!quiz) return next(new ErrorResponse('Quiz not found', 404));
  res.json({ success: true, data: quiz });
});

// ─── STUDENT ──────────────────────────────────────────────────────────────────

const buildStudentQuery = (userId) => {
  const now = new Date();
  return {
    status: 'published',
    $or: [{ assignedTo: { $in: [userId] } }, { assignedTo: { $size: 0 } }]
  };
};

exports.getAvailableQuizzes = asyncHandler(async (req, res) => {
  const now = new Date();
  const { type, course, page = 1, limit = 12 } = req.query;
  const query = {
    ...buildStudentQuery(req.user._id),
    $and: [
      { $or: [{ 'schedule.startDate': null }, { 'schedule.startDate': { $lte: now } }] },
      { $or: [{ 'schedule.endDate': null }, { 'schedule.endDate': { $gte: now } }] }
    ]
  };
  if (type)   query.type = type;
  if (course) query.course = course;
  const total = await Quiz.countDocuments(query);
  const quizzes = await Quiz.find(query)
    .populate('course', 'name category thumbnail')
    .select('-questions -assignedTo')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ success: true, total, data: quizzes });
});

exports.getUpcomingQuizzes = asyncHandler(async (req, res) => {
  const now = new Date();
  const query = {
    ...buildStudentQuery(req.user._id),
    'schedule.startDate': { $gt: now }
  };
  const quizzes = await Quiz.find(query)
    .populate('course', 'name')
    .select('-questions -assignedTo')
    .sort({ 'schedule.startDate': 1 })
    .limit(20);
  res.json({ success: true, data: quizzes });
});

exports.getCompletedQuizzes = asyncHandler(async (req, res) => {
  const attempts = await QuizAttempt.find({ student: req.user._id, status: 'submitted' })
    .populate({ path: 'quiz', select: 'title type totalMarks duration course', populate: { path: 'course', select: 'name' } })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ success: true, data: attempts });
});

exports.getPracticeQuizzes = asyncHandler(async (req, res) => {
  const quizzes = await Quiz.find({ ...buildStudentQuery(req.user._id), type: 'practice' })
    .populate('course', 'name')
    .select('-questions -assignedTo')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: quizzes });
});

exports.getAttemptStatus = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) return next(new ErrorResponse('Quiz not found', 404));
  const attempts = await QuizAttempt.find({ quiz: quiz._id, student: req.user._id });
  const submitted = attempts.filter(a => a.status === 'submitted').length;
  const inProgress = attempts.find(a => a.status === 'in_progress');
  res.json({
    success: true,
    data: {
      attemptsUsed: submitted,
      attemptsAllowed: quiz.attemptsAllowed,
      canAttempt: submitted < quiz.attemptsAllowed,
      inProgressAttemptId: inProgress?._id || null
    }
  });
});

exports.startQuiz = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id).populate('questions');
  if (!quiz) return next(new ErrorResponse('Quiz not found', 404));
  if (quiz.status !== 'published') return next(new ErrorResponse('Quiz is not available', 400));

  const submitted = await QuizAttempt.countDocuments({ quiz: quiz._id, student: req.user._id, status: 'submitted' });
  if (submitted >= quiz.attemptsAllowed)
    return next(new ErrorResponse(`Maximum ${quiz.attemptsAllowed} attempt(s) allowed`, 400));

  let attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id, status: 'in_progress' });
  if (!attempt) {
    attempt = await QuizAttempt.create({
      quiz: quiz._id, student: req.user._id,
      attemptNumber: submitted + 1,
      ipAddress: req.ip, userAgent: req.get('user-agent')
    });
  }

  let questions = [...quiz.questions];
  if (quiz.shuffleQuestions) questions = questions.sort(() => Math.random() - 0.5);

  const safeQuestions = questions.map(q => {
    const qObj = q.toObject();
    if (quiz.shuffleOptions && qObj.options?.length) {
      qObj.options = qObj.options.sort(() => Math.random() - 0.5);
    }
    qObj.options = (qObj.options || []).map(({ _id, text, image }) => ({ _id, text, image }));
    delete qObj.correctAnswer;
    delete qObj.explanation;
    return qObj;
  });

  res.json({ success: true, data: { attempt, quiz: { ...quiz.toObject(), questions: safeQuestions } } });
});

exports.saveAnswer = asyncHandler(async (req, res, next) => {
  const { questionId, selectedOption, textAnswer, isMarkedForReview, timeSpent } = req.body;
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, student: req.user._id, status: 'in_progress' });
  if (!attempt) return next(new ErrorResponse('Active attempt not found', 404));

  const answerIndex = attempt.answers.findIndex(a => a.question.toString() === questionId);
  const answerData = { question: questionId, selectedOption: selectedOption || null, textAnswer: textAnswer || null, isMarkedForReview: !!isMarkedForReview, timeSpent: timeSpent || 0 };

  if (answerIndex >= 0) attempt.answers[answerIndex] = answerData;
  else attempt.answers.push(answerData);
  await attempt.save();
  res.json({ success: true, message: 'Answer saved' });
});

exports.submitQuiz = asyncHandler(async (req, res, next) => {
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, student: req.user._id })
    .populate({ path: 'quiz', populate: { path: 'questions' } });
  if (!attempt) return next(new ErrorResponse('Attempt not found', 404));
  if (attempt.status === 'submitted') return next(new ErrorResponse('Already submitted', 400));

  const quiz = attempt.quiz;
  let totalScore = 0, correct = 0, wrong = 0, skipped = 0;
  const subjectMap = {};

  for (const answer of attempt.answers) {
    const question = quiz.questions.find(q => q._id.toString() === answer.question.toString());
    if (!question) continue;
    let isCorrect = false;
    if (['multiple_choice','single_choice','true_false'].includes(question.type)) {
      const correctOpt = question.options.find(o => o.isCorrect);
      isCorrect = correctOpt && answer.selectedOption?.toString() === correctOpt._id.toString();
    } else if (['fill_blank','short_answer'].includes(question.type)) {
      isCorrect = answer.textAnswer?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
    }
    answer.isCorrect = isCorrect;
    answer.marksObtained = isCorrect ? question.marks : 0;
    if (isCorrect) { totalScore += question.marks; correct++; }
    else if (answer.selectedOption || answer.textAnswer) wrong++;
    else skipped++;
    const subj = question.subject || 'General';
    if (!subjectMap[subj]) subjectMap[subj] = { total: 0, correct: 0 };
    subjectMap[subj].total++;
    if (isCorrect) subjectMap[subj].correct++;
  }

  attempt.status = 'submitted';
  attempt.endTime = new Date();
  attempt.score = totalScore;
  attempt.percentage = quiz.totalMarks > 0 ? (totalScore / quiz.totalMarks) * 100 : 0;
  attempt.isPassed = totalScore >= quiz.passingMarks;
  attempt.timeSpent = Math.floor((attempt.endTime - attempt.startTime) / 1000);
  await attempt.save();

  const subjectAnalysis = Object.entries(subjectMap).map(([subject, d]) => ({
    subject, total: d.total, correct: d.correct, percentage: Math.round((d.correct / d.total) * 100)
  }));

  const result = await Result.create({
    attempt: attempt._id, quiz: quiz._id, student: req.user._id,
    totalMarks: quiz.totalMarks, marksObtained: totalScore,
    percentage: attempt.percentage, correctAnswers: correct,
    wrongAnswers: wrong, skippedAnswers: skipped,
    isPassed: attempt.isPassed, subjectAnalysis,
    isPublished: quiz.showResult, timeTaken: attempt.timeSpent
  });

  // Notify student result is ready
  await Notification.create({
    recipient: req.user._id, recipientModel: 'User',
    type: 'result_published', title: 'Quiz Submitted',
    message: `Your result for "${quiz.title}" is ready`,
    data: { resultId: result._id }, link: `/student/results/${result._id}`
  });

  res.json({ success: true, data: result });
});

exports.getStudentResults = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const total = await Result.countDocuments({ student: req.user._id, isPublished: true });
  const results = await Result.find({ student: req.user._id, isPublished: true })
    .populate('quiz', 'title type totalMarks passingMarks course')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ success: true, total, pages: Math.ceil(total / limit), data: results });
});

exports.getResultDetail = asyncHandler(async (req, res, next) => {
  const result = await Result.findOne({ _id: req.params.id, student: req.user._id })
    .populate('quiz')
    .populate({ path: 'attempt', populate: { path: 'answers.question' } });
  if (!result) return next(new ErrorResponse('Result not found', 404));
  res.json({ success: true, data: result });
});
