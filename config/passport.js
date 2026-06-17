const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/sendEmail');

console.log('🔧 Initializing Passport Strategies...');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// ============================================
// EMAIL NOTIFICATION FUNCTIONS
// ============================================

// Send email to Super Admin when new admin registers
const notifySuperAdmins = async (newAdmin) => {
  try {
    // Get all super admins
    const superAdmins = await Admin.find({
      role: 'super_admin',
      isActive: true,
      isApproved: true
    });

    console.log(`📧 Notifying ${superAdmins.length} super admins about new admin: ${newAdmin.email}`);

    for (const superAdmin of superAdmins) {
      try {
        const approvalLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/pending-approvals`;
        
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

// Send email to admin when approved
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

// Send email to admin when rejected
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

// ============================================
// STUDENT GOOGLE STRATEGY
// ============================================
passport.use(
  'user-google',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/google/callback`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      console.log('👤 Student Google Strategy Called');
      console.log('📧 Student Email:', profile.emails?.[0]?.value);

      try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          user.lastLogin = new Date();
          user.loginCount += 1;
          await user.save();
          return done(null, user);
        }

        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          user.googleId = profile.id;
          user.authProvider = 'google';
          user.isEmailVerified = true;
          user.profilePicture = profile.photos?.[0]?.value || user.profilePicture;
          user.lastLogin = new Date();
          user.loginCount += 1;
          await user.save();
          return done(null, user);
        }

        const nameParts = profile.displayName.split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';

        const newUser = await User.create({
          firstName,
          lastName,
          email: profile.emails[0].value,
          googleId: profile.id,
          authProvider: 'google',
          profilePicture: profile.photos?.[0]?.value || null,
          isEmailVerified: true,
          isActive: true,
          lastLogin: new Date(),
          loginCount: 1
        });

        return done(null, newUser);

      } catch (error) {
        console.error('❌ Student Google Strategy Error:', error);
        return done(error, null);
      }
    }
  )
);

// ============================================
// ADMIN GOOGLE STRATEGY
// ============================================
passport.use(
  'admin-google',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/admin/auth/google/callback`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      console.log('🛡️ ADMIN Google Strategy Called!');
      console.log('📧 Admin Email:', profile.emails?.[0]?.value);
      console.log('🆔 Admin Google ID:', profile.id);

      try {
        const { id, emails, name, photos } = profile;
        const email = emails[0].value;

        // Check if admin exists with Google ID
        let admin = await Admin.findOne({ googleId: id });

        if (admin) {
          console.log('✅ Admin found with Google ID:', admin.email);

          if (!admin.isApproved) {
            console.log('⏳ Admin not approved yet');
            return done(null, false, {
              message: 'Your admin account is pending approval. You will receive an email once approved.',
              isPending: true
            });
          }

          admin.lastLogin = Date.now();
          admin.profilePicture = photos?.[0]?.value || admin.profilePicture;
          await admin.save({ validateBeforeSave: false });

          return done(null, admin);
        }

        // Check if admin exists with email
        admin = await Admin.findOne({ email });

        if (admin) {
          console.log('✅ Admin found with email:', admin.email);

          if (!admin.googleId) {
            admin.googleId = id;
            admin.profilePicture = photos?.[0]?.value || admin.profilePicture;
            admin.registrationMethod = 'google';
            await admin.save({ validateBeforeSave: false });
          }

          if (!admin.isApproved) {
            console.log('⏳ Admin not approved yet');
            return done(null, false, {
              message: 'Your admin account is pending approval. You will receive an email once approved.',
              isPending: true
            });
          }

          admin.lastLogin = Date.now();
          await admin.save({ validateBeforeSave: false });

          return done(null, admin);
        }

        // Check for pending admin
        const pendingAdmin = await Admin.findOne({
          email,
          isApproved: false
        });

        if (pendingAdmin) {
          console.log('⏳ Pending admin found:', pendingAdmin.email);

          pendingAdmin.googleId = id;
          pendingAdmin.firstName = name.givenName || pendingAdmin.firstName;
          pendingAdmin.lastName = name.familyName || pendingAdmin.lastName;
          pendingAdmin.profilePicture = photos?.[0]?.value || pendingAdmin.profilePicture;
          pendingAdmin.registrationMethod = 'google';
          await pendingAdmin.save({ validateBeforeSave: false });

          return done(null, false, {
            message: 'Your admin account is pending approval. You will receive an email once approved.',
            isPending: true,
            adminId: pendingAdmin._id
          });
        }

        // Create new admin
        console.log('🆕 Creating new admin with Google:', email);

        const newAdmin = await Admin.create({
          firstName: name.givenName || 'Google',
          lastName: name.familyName || 'User',
          email: email,
          googleId: id,
          profilePicture: photos?.[0]?.value || null,
          isApproved: false,
          isActive: true,
          registrationMethod: 'google',
          password: undefined
        });

        console.log('✅ New admin created:', newAdmin.email);

        // 🔥 Send notification to Super Admins
        await notifySuperAdmins(newAdmin);

        return done(null, false, {
          message: 'Your admin registration is submitted for approval. You will receive an email once approved.',
          isPending: true,
          adminId: newAdmin._id
        });

      } catch (error) {
        console.error('❌ Admin Google Strategy Error:', error);
        return done(error, null);
      }
    }
  )
);

console.log('✅ Passport strategies initialized');

module.exports = { 
  generateToken,
  notifySuperAdmins,
  sendAdminApprovalEmail,
  sendAdminRejectionEmail
};