const crypto = require('crypto');
const Admin = require('../models/Admin');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');
const { sendToken } = require('../utils/sendToken');
const { sendEmail, emailTemplates } = require('../utils/sendEmail');

// -----------------------------
// LOGIN (Email/Password)
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

  if (!admin.isApproved) {
    return res.status(403).json({
      success: false,
      message: 'Your admin account is pending approval. You will receive an email once approved.',
      isPending: true
    });
  }

  admin.lastLogin = Date.now();
  await admin.save({ validateBeforeSave: false });

  const adminObj = admin.toObject();
  delete adminObj.password;

  sendToken(adminObj, 200, res, true);
});

// -----------------------------
// GOOGLE LOGIN FOR ADMIN
// -----------------------------
exports.googleAdminLogin = asyncHandler(async (req, res, next) => {
  const { googleId, email, firstName, lastName, profilePicture } = req.body;

  if (!googleId || !email) {
    return next(new ErrorResponse('Google ID and email required', 400));
  }

  // Check if admin exists with this email
  let admin = await Admin.findOne({ email });

  if (admin) {
    // Admin exists - check if approved
    if (!admin.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your admin account is pending approval. You will receive an email once approved.',
        isPending: true
      });
    }

    // Update Google ID if not set
    if (!admin.googleId) {
      admin.googleId = googleId;
    }
    
    admin.profilePicture = profilePicture || admin.profilePicture;
    admin.lastLogin = Date.now();
    await admin.save({ validateBeforeSave: false });

    const adminObj = admin.toObject();
    delete adminObj.password;

    sendToken(adminObj, 200, res, true);
  } else {
    // New admin trying to register with Google
    // Check if there's a pending admin with this email (from email registration)
    const pendingAdmin = await Admin.findOne({ 
      email, 
      isApproved: false 
    });

    if (pendingAdmin) {
      // Update pending admin with Google info
      pendingAdmin.googleId = googleId;
      pendingAdmin.firstName = firstName || pendingAdmin.firstName;
      pendingAdmin.lastName = lastName || pendingAdmin.lastName;
      pendingAdmin.profilePicture = profilePicture || pendingAdmin.profilePicture;
      pendingAdmin.registrationMethod = 'google';
      await pendingAdmin.save({ validateBeforeSave: false });

      return res.status(403).json({
        success: false,
        message: 'Your admin account is pending approval. You will receive an email once approved.',
        isPending: true
      });
    }

    // Create new admin with Google (pending approval)
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

    // 🔥 Notify super admin about new Google admin registration
    await notifySuperAdmins(newAdmin);

    res.status(201).json({
      success: false,
      message: 'Your admin registration is submitted for approval. You will receive an email once approved.',
      isPending: true,
      adminId: newAdmin._id
    });
  }
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
// CREATE ADMIN (By Super Admin)
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

// -----------------------------
// SUPER ADMIN - GET PENDING ADMINS
// -----------------------------
exports.getPendingAdmins = asyncHandler(async (req, res, next) => {
  // Only super admin can access
  if (req.admin.role !== 'super_admin') {
    return next(new ErrorResponse('Access denied. Super admin only.', 403));
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
});

// -----------------------------
// SUPER ADMIN - APPROVE ADMIN (With Email)
// -----------------------------
exports.approveAdmin = asyncHandler(async (req, res, next) => {
  // Only super admin can approve
  if (req.admin.role !== 'super_admin') {
    return next(new ErrorResponse('Access denied. Super admin only.', 403));
  }

  const { adminId } = req.params;

  const admin = await Admin.findById(adminId);

  if (!admin) {
    return next(new ErrorResponse('Admin not found', 404));
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

  // 🔥 Send approval email to admin
  try {
    await sendAdminApprovalEmail(admin);
    console.log(`✅ Approval email sent to: ${admin.email}`);
  } catch (err) {
    console.log('❌ Email notification failed:', err.message);
  }

  res.json({
    success: true,
    message: 'Admin approved successfully. Email notification sent.',
    data: admin
  });
});

// -----------------------------
// SUPER ADMIN - REJECT ADMIN (With Email)
// -----------------------------
exports.rejectAdmin = asyncHandler(async (req, res, next) => {
  // Only super admin can reject
  if (req.admin.role !== 'super_admin') {
    return next(new ErrorResponse('Access denied. Super admin only.', 403));
  }

  const { adminId } = req.params;

  const admin = await Admin.findById(adminId);

  if (!admin) {
    return next(new ErrorResponse('Admin not found', 404));
  }

  if (admin.isApproved) {
    return res.status(400).json({
      success: false,
      message: 'Cannot reject an already approved admin'
    });
  }

  // 🔥 Send rejection email before deactivating
  try {
    await sendAdminRejectionEmail(admin);
    console.log(`✅ Rejection email sent to: ${admin.email}`);
  } catch (err) {
    console.log('❌ Email notification failed:', err.message);
  }

  // Deactivate the admin
  admin.isActive = false;
  await admin.save();

  res.json({
    success: true,
    message: 'Admin registration rejected. Email notification sent.'
  });
});

// ============================================
// EMAIL NOTIFICATION HELPERS
// ============================================

// -----------------------------
// NOTIFY SUPER ADMINS (When new admin registers)
// -----------------------------
const notifySuperAdmins = async (newAdmin) => {
  try {
    // Get all super admins
    const superAdmins = await Admin.find({ 
      role: 'super_admin',
      isActive: true,
      isApproved: true
    });

    if (superAdmins.length === 0) {
      console.log('⚠️ No super admins found to notify');
      return;
    }

    console.log(`📧 Notifying ${superAdmins.length} super admins about new admin: ${newAdmin.email}`);

    const approvalLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/pending-approvals`;

    // Send notification to each super admin
    for (const superAdmin of superAdmins) {
      try {
        await sendEmail({
          to: superAdmin.email,
          subject: '🔔 New Admin Registration Pending Approval',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 10px;">
              <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🔔 New Admin Registration</h1>
              </div>
              <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
                <p style="color: #374151; font-size: 16px;">A new admin has registered and needs your approval:</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p style="margin: 5px 0;"><strong>👤 Name:</strong> ${newAdmin.firstName} ${newAdmin.lastName}</p>
                  <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${newAdmin.email}</p>
                  <p style="margin: 5px 0;"><strong>🔗 Method:</strong> ${newAdmin.registrationMethod || 'Google'}</p>
                  <p style="margin: 5px 0;"><strong>📅 Registered:</strong> ${new Date(newAdmin.createdAt).toLocaleString()}</p>
                </div>
                <a href="${approvalLink}" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0;">Review & Approve</a>
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you didn't expect this registration, please ignore this email.</p>
              </div>
            </div>
          `
        });
        console.log(`✅ Email sent to super admin: ${superAdmin.email}`);
      } catch (err) {
        console.log(`❌ Failed to notify ${superAdmin.email}:`, err.message);
      }
    }
  } catch (err) {
    console.log('❌ Failed to fetch super admins:', err.message);
  }
};

// -----------------------------
// SEND APPROVAL EMAIL TO ADMIN
// -----------------------------
const sendAdminApprovalEmail = async (admin) => {
  try {
    const loginLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/login`;
    
    await sendEmail({
      to: admin.email,
      subject: '✅ Your Admin Account Has Been Approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 10px;">
          <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #22C55E, #16A34A); border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">✅ Account Approved!</h1>
          </div>
          <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
            <p style="color: #374151; font-size: 16px;">Dear <strong>${admin.firstName} ${admin.lastName}</strong>,</p>
            <p style="color: #374151; font-size: 16px;">Your admin account has been <strong style="color: #22C55E;">approved</strong> by the super administrator.</p>
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #22C55E;">
              <p style="margin: 5px 0;"><strong>👤 Name:</strong> ${admin.firstName} ${admin.lastName}</p>
              <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${admin.email}</p>
              <p style="margin: 5px 0;"><strong>🔑 Role:</strong> ${admin.role}</p>
            </div>
            <p style="color: #374151; font-size: 16px;">You can now login to the admin panel:</p>
            <a href="${loginLink}" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #22C55E, #16A34A); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0;">Login Now</a>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you didn't request this, please contact support.</p>
          </div>
        </div>
      `
    });
    console.log(`✅ Approval email sent to: ${admin.email}`);
  } catch (err) {
    console.log(`❌ Failed to send approval email to ${admin.email}:`, err.message);
  }
};

// -----------------------------
// SEND REJECTION EMAIL TO ADMIN
// -----------------------------
const sendAdminRejectionEmail = async (admin) => {
  try {
    await sendEmail({
      to: admin.email,
      subject: '❌ Your Admin Account Registration Was Not Approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 10px;">
          <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #EF4444, #DC2626); border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">❌ Registration Not Approved</h1>
          </div>
          <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
            <p style="color: #374151; font-size: 16px;">Dear <strong>${admin.firstName} ${admin.lastName}</strong>,</p>
            <p style="color: #374151; font-size: 16px;">We regret to inform you that your admin account registration was <strong style="color: #EF4444;">not approved</strong>.</p>
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #EF4444;">
              <p style="margin: 5px 0;"><strong>👤 Name:</strong> ${admin.firstName} ${admin.lastName}</p>
              <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${admin.email}</p>
            </div>
            <p style="color: #374151; font-size: 16px;">If you believe this is a mistake, please contact support.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">Thank you for your interest.</p>
          </div>
        </div>
      `
    });
    console.log(`✅ Rejection email sent to: ${admin.email}`);
  } catch (err) {
    console.log(`❌ Failed to send rejection email to ${admin.email}:`, err.message);
  }
};

// Export the helper functions for use in other files
module.exports = {
  login: exports.login,
  googleAdminLogin: exports.googleAdminLogin,
  getMe: exports.getMe,
  logout: exports.logout,
  forgotPassword: exports.forgotPassword,
  resetPassword: exports.resetPassword,
  changePassword: exports.changePassword,
  createAdmin: exports.createAdmin,
  getPendingAdmins: exports.getPendingAdmins,
  approveAdmin: exports.approveAdmin,
  rejectAdmin: exports.rejectAdmin,
  notifySuperAdmins,
  sendAdminApprovalEmail,
  sendAdminRejectionEmail
};