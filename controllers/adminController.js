const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const Result = require('../models/Result');
const QuizAttempt = require('../models/QuizAttempt');
const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');

// @desc  Dashboard stats
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalStudents, activeStudents, totalQuizzes, totalCourses,
    totalAttempts, recentActivities
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true, isSuspended: false }),
    Quiz.countDocuments({ status: 'published' }),
    Course.countDocuments({ isPublished: true }),
    QuizAttempt.countDocuments({ status: 'submitted' }),
    ActivityLog.find().sort({ createdAt: -1 }).limit(10)
      .populate('actor', 'firstName lastName email')
  ]);

  // Top performers
  const topPerformers = await Result.aggregate([
    { $group: { _id: '$student', avgScore: { $avg: '$percentage' }, totalAttempts: { $sum: 1 } } },
    { $sort: { avgScore: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $project: { 'student.firstName': 1, 'student.lastName': 1, 'student.email': 1, avgScore: 1, totalAttempts: 1 } }
  ]);

  // Student growth (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const studentGrowth = await User.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Quiz stats
  const quizStats = await QuizAttempt.aggregate([
    { $match: { status: 'submitted', createdAt: { $gte: sixMonthsAgo } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 }, avgScore: { $avg: '$percentage' } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  res.json({
    success: true,
    data: { totalStudents, activeStudents, totalQuizzes, totalCourses, totalAttempts, topPerformers, studentGrowth, quizStats, recentActivities }
  });
});

// @desc  Student management
exports.getStudents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, isActive, isSuspended, course } = req.query;
  const query = {};
  if (search) query.$or = [
    { firstName: { $regex: search, $options: 'i' } },
    { lastName:  { $regex: search, $options: 'i' } },
    { email:     { $regex: search, $options: 'i' } }
  ];
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (isSuspended !== undefined) query.isSuspended = isSuspended === 'true';
  if (course) query.courses = course;

  const total = await User.countDocuments(query);
  const students = await User.find(query)
    .populate('courses', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: students });
});

exports.getStudent = asyncHandler(async (req, res, next) => {
  const student = await User.findById(req.params.id).populate('courses', 'name category thumbnail');
  if (!student) return next(new ErrorResponse('Student not found', 404));

  const stats = await Result.aggregate([
    { $match: { student: student._id } },
    { $group: { _id: null, avgScore: { $avg: '$percentage' }, highestScore: { $max: '$percentage' }, totalAttempts: { $sum: 1 } } }
  ]);

  res.json({ success: true, data: { student, stats: stats[0] || {} } });
});

exports.createStudent = asyncHandler(async (req, res, next) => {
  const student = await User.create({ ...req.body, isEmailVerified: true });
  res.status(201).json({ success: true, data: student });
});

exports.updateStudent = asyncHandler(async (req, res, next) => {
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'isActive', 'courses'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const student = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!student) return next(new ErrorResponse('Student not found', 404));
  res.json({ success: true, data: student });
});

exports.deleteStudent = asyncHandler(async (req, res, next) => {
  const student = await User.findByIdAndDelete(req.params.id);
  if (!student) return next(new ErrorResponse('Student not found', 404));
  res.json({ success: true, message: 'Student deleted' });
});

exports.suspendStudent = asyncHandler(async (req, res, next) => {
  const student = await User.findByIdAndUpdate(
    req.params.id,
    { isSuspended: true, suspendReason: req.body.reason || 'No reason provided' },
    { new: true }
  );
  if (!student) return next(new ErrorResponse('Student not found', 404));
  res.json({ success: true, data: student });
});

exports.unsuspendStudent = asyncHandler(async (req, res, next) => {
  const student = await User.findByIdAndUpdate(
    req.params.id,
    { isSuspended: false, suspendReason: null },
    { new: true }
  );
  if (!student) return next(new ErrorResponse('Student not found', 404));
  res.json({ success: true, data: student });
});

exports.importStudents = asyncHandler(async (req, res, next) => {
  if (!req.body.students || !Array.isArray(req.body.students))
    return next(new ErrorResponse('Invalid import data', 400));

  const results = { success: 0, failed: 0, errors: [] };
  for (const s of req.body.students) {
    try {
      await User.create({ ...s, isEmailVerified: true, password: s.password || 'ChangeMe@123' });
      results.success++;
    } catch (e) {
      results.failed++;
      results.errors.push({ email: s.email, error: e.message });
    }
  }
  res.json({ success: true, data: results });
});

exports.exportStudents = asyncHandler(async (req, res) => {
  const students = await User.find().select('-password -refreshToken -resetPasswordToken').lean();
  res.json({ success: true, data: students });
});
