const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protectAdmin, isSuperAdmin } = require('../middleware/auth');
const { sendToken } = require('../utils/sendToken');

console.log('🔧 Admin Auth Routes Initialized');

// ============================================
// ADMIN CONTROLLER FUNCTIONS
// ============================================

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Admin account is inactive'
      });
    }

    if (!admin.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your admin account is pending approval',
        isPending: true
      });
    }

    admin.lastLogin = Date.now();
    await admin.save({ validateBeforeSave: false });

    const adminObj = admin.toObject();
    delete adminObj.password;

    sendToken(adminObj, 200, res, true);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) => {
  res.cookie('adminAccessToken', 'none', {
    expires: new Date(0),
    httpOnly: true
  });

  res.json({
    success: true,
    message: 'Logged out'
  });
};

const getMe = async (req, res) => {
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
};

const forgotPassword = async (req, res, next) => {
  res.json({ success: true, message: 'Forgot password functionality' });
};

const resetPassword = async (req, res, next) => {
  res.json({ success: true, message: 'Reset password functionality' });
};

const changePassword = async (req, res, next) => {
  res.json({ success: true, message: 'Change password functionality' });
};

const createAdmin = async (req, res, next) => {
  res.json({ success: true, message: 'Create admin functionality' });
};

const getPendingAdmins = async (req, res, next) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin only.'
      });
    }

    const pendingAdmins = await Admin.find({
      isApproved: false,
      isActive: true
    }).select('-password');

    res.json({
      success: true,
      count: pendingAdmins.length,
      data: pendingAdmins
    });
  } catch (error) {
    next(error);
  }
};

const approveAdmin = async (req, res, next) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin only.'
      });
    }

    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    if (admin.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Admin is already approved'
      });
    }

    admin.isApproved = true;
    admin.approvedBy = req.admin._id;
    admin.approvedAt = Date.now();
    await admin.save();

    res.json({
      success: true,
      message: 'Admin approved successfully',
      data: admin
    });
  } catch (error) {
    next(error);
  }
};

const rejectAdmin = async (req, res, next) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin only.'
      });
    }

    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    if (admin.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an already approved admin'
      });
    }

    admin.isActive = false;
    await admin.save();

    res.json({
      success: true,
      message: 'Admin registration rejected'
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GOOGLE AUTH ROUTES - ADMIN
// ============================================

router.get('/google',
  (req, res, next) => {
    console.log('🔗🔗🔗 ADMIN Google route hit!');
    console.log('📡 Full URL:', req.originalUrl);
    next();
  },
  passport.authenticate('admin-google', {
    scope: ['profile', 'email'],
    session: false,
    prompt: 'select_account'
  })
);

router.get('/google/callback',
  (req, res, next) => {
    console.log('🔄🔄🔄 ADMIN Google callback received!');
    console.log('📡 Full URL:', req.originalUrl);
    next();
  },
  passport.authenticate('admin-google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/login?error=google_auth_failed`
  }),
  (req, res) => {
    console.log('✅✅✅ Admin Google Callback Success!');
    console.log('👤 Admin User:', req.user);
    console.log('📝 Auth Info:', req.authInfo);

    if (req.user) {
      const adminObj = req.user.toObject();
      delete adminObj.password;

      const token = jwt.sign(
        { id: adminObj._id, role: adminObj.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const adminData = encodeURIComponent(JSON.stringify(adminObj));
      console.log('🔑 Token generated');
      
      return res.redirect(
        `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/auth-success?token=${token}&admin=${adminData}`
      );
    }

    if (req.authInfo?.isPending) {
      console.log('⏳ Admin pending approval:', req.authInfo.message);
      return res.redirect(
        `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/login?pending=true&message=${encodeURIComponent(req.authInfo.message)}`
      );
    }

    console.log('❌ Admin Google callback failed');
    return res.redirect(
      `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/login?error=google_login_failed`
    );
  }
);

router.post('/google-login', async (req, res) => {
  try {
    const { googleId, email, firstName, lastName, profilePicture } = req.body;

    console.log('📥 Admin Google Login Request:', { googleId, email, firstName, lastName });

    if (!googleId || !email) {
      return res.status(400).json({
        success: false,
        message: 'Google ID and email required'
      });
    }

    let admin = await Admin.findOne({ email });

    if (admin) {
      console.log('👤 Admin found:', admin.email);

      if (!admin.isApproved) {
        return res.status(403).json({
          success: false,
          message: 'Your admin account is pending approval',
          isPending: true
        });
      }

      if (!admin.googleId) {
        admin.googleId = googleId;
      }

      admin.profilePicture = profilePicture || admin.profilePicture;
      admin.lastLogin = Date.now();
      await admin.save({ validateBeforeSave: false });

      const adminObj = admin.toObject();
      delete adminObj.password;

      return sendToken(adminObj, 200, res, true);
    }

    const pendingAdmin = await Admin.findOne({
      email,
      isApproved: false
    });

    if (pendingAdmin) {
      console.log('⏳ Pending admin found:', pendingAdmin.email);

      pendingAdmin.googleId = googleId;
      pendingAdmin.firstName = firstName || pendingAdmin.firstName;
      pendingAdmin.lastName = lastName || pendingAdmin.lastName;
      pendingAdmin.profilePicture = profilePicture || pendingAdmin.profilePicture;
      pendingAdmin.registrationMethod = 'google';
      await pendingAdmin.save({ validateBeforeSave: false });

      return res.status(403).json({
        success: false,
        message: 'Your admin account is pending approval',
        isPending: true
      });
    }

    console.log('🆕 Creating new admin:', email);

    const newAdmin = await Admin.create({
      firstName: firstName || 'Google',
      lastName: lastName || 'User',
      email,
      googleId,
      profilePicture: profilePicture || null,
      isApproved: false,
      isActive: true,
      registrationMethod: 'google',
      password: undefined
    });

    console.log('✅ New admin created:', newAdmin.email);

    try {
      const superAdmins = await Admin.find({
        role: 'super_admin',
        isActive: true,
        isApproved: true
      });
      console.log(`📧 Notifying ${superAdmins.length} super admins`);
    } catch (err) {
      console.log('Failed to notify super admins:', err);
    }

    res.status(201).json({
      success: false,
      message: 'Your admin registration is submitted for approval',
      isPending: true,
      adminId: newAdmin._id
    });

  } catch (error) {
    console.error('❌ Admin Google Login Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Google login failed'
    });
  }
});

// ============================================
// OTHER ADMIN ROUTES
// ============================================

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

router.post('/logout', protectAdmin, logout);
router.get('/me', protectAdmin, getMe);
router.put('/change-password', protectAdmin, changePassword);
router.post('/create', protectAdmin, createAdmin);

router.get('/pending', protectAdmin, isSuperAdmin, getPendingAdmins);
router.put('/approve/:adminId', protectAdmin, isSuperAdmin, approveAdmin);
router.delete('/reject/:adminId', protectAdmin, isSuperAdmin, rejectAdmin);

module.exports = router;