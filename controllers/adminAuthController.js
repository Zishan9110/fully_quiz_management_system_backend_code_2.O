const crypto = require('crypto');
const Admin = require('../models/Admin');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');
const { sendToken } = require('../utils/sendToken');
const { sendEmail, emailTemplates } = require('../utils/sendEmail');

// -----------------------------
// LOGIN
// -----------------------------
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse('Please provide email and password', 400));
  }

  const admin = await Admin.findOne({ email }).select('+password');

  if (!admin || !(await admin.matchPassword(password))) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  if (!admin.isActive) {
    return next(new ErrorResponse('Admin account is inactive', 403));
  }

  admin.lastLogin = Date.now();
  await admin.save({ validateBeforeSave: false });

  const adminObj = admin.toObject();
  delete adminObj.password;

  sendToken(adminObj, 200, res, true);
});

// -----------------------------
// GET ME
// -----------------------------
exports.getMe = asyncHandler(async (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: 'Admin not found in request'
    });
  }

  res.json({
    success: true,
    data: req.admin
  });
});

// -----------------------------
// LOGOUT
// -----------------------------
exports.logout = asyncHandler(async (req, res) => {
  res.cookie('adminAccessToken', 'none', {
    expires: new Date(0),
    httpOnly: true
  });

  res.json({
    success: true,
    message: 'Logged out'
  });
});

// -----------------------------
// FORGOT PASSWORD
// -----------------------------
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const admin = await Admin.findOne({ email: req.body.email });

  if (!admin) {
    return next(new ErrorResponse('No admin with that email', 404));
  }

  const resetToken = crypto.randomBytes(32).toString('hex');

  admin.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  admin.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  await admin.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/admin/reset-password/${resetToken}`;
  const tmpl = emailTemplates.passwordReset(admin.firstName, resetUrl);

  try {
    await sendEmail({ to: admin.email, ...tmpl });

    res.json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (err) {
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;
    await admin.save({ validateBeforeSave: false });

    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

// -----------------------------
// RESET PASSWORD
// -----------------------------
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const admin = await Admin.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!admin) {
    return next(new ErrorResponse('Invalid or expired token', 400));
  }

  admin.password = req.body.password;
  admin.resetPasswordToken = undefined;
  admin.resetPasswordExpire = undefined;

  await admin.save();

  res.json({
    success: true,
    message: 'Password reset successful'
  });
});

// -----------------------------
// CHANGE PASSWORD
// -----------------------------
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const admin = await Admin.findById(req.admin._id).select('+password');

  if (!(await admin.matchPassword(currentPassword))) {
    return next(new ErrorResponse('Current password incorrect', 400));
  }

  admin.password = newPassword;
  await admin.save();

  res.json({
    success: true,
    message: 'Password changed'
  });
});

// -----------------------------
// CREATE ADMIN
// -----------------------------
exports.createAdmin = asyncHandler(async (req, res, next) => {
  const { secret, ...adminData } = req.body;

  if (secret !== process.env.ADMIN_REGISTRATION_SECRET) {
    return next(new ErrorResponse('Invalid registration secret', 403));
  }

  const admin = await Admin.create(adminData);

  const adminObj = admin.toObject();
  delete adminObj.password;

  res.status(201).json({
    success: true,
    data: adminObj
  });
});