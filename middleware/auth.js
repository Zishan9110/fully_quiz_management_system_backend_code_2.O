const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const asyncHandler = require('./asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');

// Protect student routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(new ErrorResponse('Not authorized, token missing', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    if (!req.user)
      return next(new ErrorResponse('User not found', 401));

    if (!req.user.isActive)
      return next(new ErrorResponse('Account is inactive', 401));

    if (req.user.isSuspended)
      return next(new ErrorResponse('Account is suspended', 403));

    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized, invalid token', 401));
  }
});;

// Protect admin routes
exports.protectAdmin = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.adminAccessToken) {
    token = req.cookies.adminAccessToken;
  }
  if (!token) return next(new ErrorResponse('Not authorized', 401));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id);
    if (!req.admin) return next(new ErrorResponse('Admin not found', 401));
    if (!req.admin.isActive) return next(new ErrorResponse('Admin account is inactive', 401));
    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized, invalid token', 401));
  }
});

// Role authorization
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin?.role)) {
    return next(new ErrorResponse(`Role ${req.admin?.role} is not authorized`, 403));
  }
  next();
};

// Check admin permission
exports.requirePermission = (permission) => (req, res, next) => {
  if (!req.admin?.permissions[permission]) {
    return next(new ErrorResponse('Insufficient permissions', 403));
  }
  next();
};
