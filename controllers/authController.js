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

exports.register = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return next(new ErrorResponse('Email already registered', 400));
  
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    firstName, lastName, email, password,
    emailVerificationToken: crypto.createHash('sha256').update(verifyToken).digest('hex'),
    emailVerificationExpire: Date.now() + 24 * 60 * 60 * 1000
  });
  
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verifyToken}`;
  const tmpl = emailTemplates.emailVerification(user.firstName, verifyUrl);
  try { await sendEmail({ to: user.email, ...tmpl }); } catch (e) {}
  
  res.status(201).json({ success: true, message: 'Registration successful. Please verify your email.' });
});

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

exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return next(new ErrorResponse('Please provide email and password', 400));

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.matchPassword(password)))
    return next(new ErrorResponse('Invalid credentials', 401));

  if (!user.isActive || user.isSuspended)
    return next(new ErrorResponse('Account is suspended or inactive', 403));

  user.lastLogin = Date.now();
  user.loginCount = (user.loginCount || 0) + 1;

  await user.save({ validateBeforeSave: false });

  const userObj = user.toObject();
  delete userObj.password;

  sendToken(userObj, 200, res); // ONLY ACCESS TOKEN
});

exports.logout = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
  
  res.cookie('accessToken', 'none', { expires: new Date(0), httpOnly: true });
  res.cookie('refreshToken', 'none', { expires: new Date(0), httpOnly: true });
  
  res.json({ success: true, message: 'Logged out successfully' });
});

exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate('courses', 'name thumbnail category instructor');
  res.json({ success: true, data: user });
});

exports.updateProfile = asyncHandler(async (req, res, next) => {
  const allowed = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'address', 'preferences'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ success: true, data: user });
});

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

// Complete refreshToken function - REPLACE the existing one
// exports.refreshToken = asyncHandler(async (req, res, next) => {
//   const { refreshToken } = req.body;
  
//   console.log('🔄 Refresh token request received');
  
//   if (!refreshToken) {
//     console.log('❌ No refresh token provided');
//     return next(new ErrorResponse('No refresh token provided', 401));
//   }
  
//   try {
//     const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
//     console.log('✅ Refresh token verified for user:', decoded.id);
    
//     const user = await User.findById(decoded.id).select('+refreshToken');
    
//     if (!user) {
//       console.log('❌ User not found');
//       return next(new ErrorResponse('User not found', 401));
//     }
    
//     if (user.refreshToken !== refreshToken) {
//       console.log('❌ Refresh token mismatch');
//       return next(new ErrorResponse('Invalid refresh token', 401));
//     }
    
//     if (!user.isActive || user.isSuspended) {
//       console.log('❌ Account is inactive');
//       return next(new ErrorResponse('Account is inactive', 403));
//     }
    
//     // Generate new tokens
//     const newAccessToken = generateAccessToken(user._id);
//     const newRefreshToken = generateRefreshToken(user._id);
    
//     // Update refresh token in database
//     user.refreshToken = newRefreshToken;
//     await user.save({ validateBeforeSave: false });
    
//     console.log('✅ New tokens generated for user');
    
//     res.json({
//       success: true,
//       accessToken: newAccessToken,
//       refreshToken: newRefreshToken
//     });
    
//   } catch (err) {
//     console.log("❌ Refresh token error:", err.message);
//     return next(new ErrorResponse('Invalid or expired refresh token', 401));
//   }
// });

// @desc  Student dashboard stats
exports.getStudentStats = asyncHandler(async (req, res, next) => {
  const studentId = req.user._id;

  const [resultStats, rankEntry, recentResults, attemptCount] = await Promise.all([
    Result.aggregate([
      { $match: { student: studentId } },
      { $group: {
        _id: null,
        avgScore: { $avg: '$percentage' },
        highestScore: { $max: '$percentage' },
        totalAttempts: { $sum: 1 },
        totalCorrect: { $sum: '$correctAnswers' },
        totalWrong: { $sum: '$wrongAnswers' }
      }}
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
    { $group: {
      _id: '$subjectAnalysis.subject',
      avgPct: { $avg: '$subjectAnalysis.percentage' },
      count: { $sum: 1 }
    }},
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
      subjectBreakdown: subjectAgg.map(s => ({ name: s._id, value: Math.round(s.avgPct) }))
    }
  });
});