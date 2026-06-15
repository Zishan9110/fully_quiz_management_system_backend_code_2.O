const crypto = require('crypto');
const User = require('../models/User');
const Result = require('../models/Result');
const QuizAttempt = require('../models/QuizAttempt');
const Leaderboard = require('../models/Leaderboard');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');
const { sendToken, generateAccessToken, generateRefreshToken } = require('../utils/sendToken');
const { sendEmail, emailTemplates } = require('../utils/sendEmail');
const ActivityLog = require('../models/ActivityLog');
const jwt = require('jsonwebtoken');

// @desc    Register a new user (Email verification DISABLED for development)
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;
  
  // Check if user already exists
  const existing = await User.findOne({ email });
  if (existing) return next(new ErrorResponse('Email already registered', 400));
  
  // Check if email verification is required (set in .env)
  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  
  let user;
  
  if (!requireVerification) {
    // DEVELOPMENT MODE: Create user with email already verified
    user = await User.create({
      firstName,
      lastName,
      email,
      password,
      isEmailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationExpire: undefined
    });
    
    // Return success without sending verification email
    return res.status(201).json({
      success: true,
      message: 'Registration successful! You can now login.',
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  }
  
  // PRODUCTION MODE: Send verification email
  const verifyToken = crypto.randomBytes(32).toString('hex');
  user = await User.create({
    firstName,
    lastName,
    email,
    password,
    emailVerificationToken: crypto.createHash('sha256').update(verifyToken).digest('hex'),
    emailVerificationExpire: Date.now() + 24 * 60 * 60 * 1000,
    isEmailVerified: false
  });
  
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verifyToken}`;
  const tmpl = emailTemplates.emailVerification(user.firstName, verifyUrl);
  
  try {
    await sendEmail({ to: user.email, ...tmpl });
  } catch (e) {
    console.error('Email sending failed:', e);
  }
  
  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email.'
  });
});

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() }
  });
  
  if (!user) return next(new ErrorResponse('Invalid or expired verification token', 400));
  
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  await user.save();
  
  res.json({ success: true, message: 'Email verified successfully. You can now login.' });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return next(new ErrorResponse('Please provide email and password', 400));

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.matchPassword(password)))
    return next(new ErrorResponse('Invalid credentials', 401));

  // Check if account is active
  if (!user.isActive || user.isSuspended)
    return next(new ErrorResponse('Account is suspended or inactive', 403));

  // Skip email verification check in development
  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  
  if (requireVerification && !user.isEmailVerified) {
    return next(new ErrorResponse('Please verify your email before logging in', 401));
  }

  // Update last login
  user.lastLogin = Date.now();
  user.loginCount = (user.loginCount || 0) + 1;
  await user.save({ validateBeforeSave: false });

  const userObj = user.toObject();
  delete userObj.password;

  sendToken(userObj, 200, res);
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
  
  res.cookie('accessToken', 'none', { expires: new Date(0), httpOnly: true });
  res.cookie('refreshToken', 'none', { expires: new Date(0), httpOnly: true });
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate('courses', 'name thumbnail category instructor');
  res.json({ success: true, data: user });
});

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const allowed = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'address', 'preferences'];
  const updates = {};
  allowed.forEach(f => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });
  
  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true
  });
  
  res.json({ success: true, data: user });
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  
  if (!(await user.matchPassword(currentPassword))) {
    return next(new ErrorResponse('Current password is incorrect', 400));
  }
  
  user.password = newPassword;
  await user.save();
  
  res.json({ success: true, message: 'Password changed successfully' });
});

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new ErrorResponse('No account with that email', 404));
  
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });
  
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  const tmpl = emailTemplates.passwordReset(user.firstName, resetUrl);
  
  try {
    await sendEmail({ to: user.email, ...tmpl });
    res.json({ success: true, message: 'Password reset email sent' });
  } catch (e) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });
  
  if (!user) return next(new ErrorResponse('Invalid or expired token', 400));
  
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  
  res.json({ success: true, message: 'Password reset successful' });
});

// @desc    Student dashboard stats
// @route   GET /api/auth/student-stats
// @access  Private
exports.getStudentStats = asyncHandler(async (req, res, next) => {
  const studentId = req.user._id;

  const [resultStats, rankEntry, recentResults, attemptCount] = await Promise.all([
    Result.aggregate([
      { $match: { student: studentId } },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$percentage' },
          highestScore: { $max: '$percentage' },
          totalAttempts: { $sum: 1 },
          totalCorrect: { $sum: '$correctAnswers' },
          totalWrong: { $sum: '$wrongAnswers' }
        }
      }
    ]),
    Leaderboard.findOne({ student: studentId, type: 'global' }),
    Result.find({ student: studentId, isPublished: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('quiz', 'title type totalMarks'),
    QuizAttempt.countDocuments({ student: studentId, status: 'submitted' })
  ]);

  // Subject breakdown from all results
  const subjectAgg = await Result.aggregate([
    { $match: { student: studentId } },
    { $unwind: '$subjectAnalysis' },
    {
      $group: {
        _id: '$subjectAnalysis.subject',
        avgPct: { $avg: '$subjectAnalysis.percentage' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 6 }
  ]);

  const stats = resultStats[0] || {};
  
  res.json({
    success: true,
    data: {
      totalAttempts: attemptCount,
      avgScore: Math.round(stats.avgScore || 0),
      highestScore: Math.round(stats.highestScore || 0),
      rank: rankEntry?.rank || null,
      totalCorrect: stats.totalCorrect || 0,
      totalWrong: stats.totalWrong || 0,
      recentResults,
      subjectBreakdown: subjectAgg.map(s => ({
        name: s._id,
        value: Math.round(s.avgPct)
      }))
    }
  });
});