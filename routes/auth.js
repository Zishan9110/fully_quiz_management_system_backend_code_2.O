const express = require('express');
const router = express.Router();
const passport = require('passport'); // 🔥 YAHAN IMPORT KARO
const User = require('../models/User'); // 🔥 YAHAN IMPORT KARO
const { protect } = require('../middleware/auth');
const { generateToken } = require('../config/passport');
const { OAuth2Client } = require('google-auth-library');
const {
  register, verifyEmail, login, logout, getMe,
  updateProfile, changePassword, forgotPassword, resetPassword,
  refreshToken, getStudentStats
} = require('../controllers/authController');


// Public routes (NO authentication needed)
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
// router.post('/refresh-token', refreshToken); // ← MOVED to public routes

// ============ 🔥 GOOGLE AUTH ROUTES ============

// Route 1: Initiate Google OAuth (Redirect flow)
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

// Route 2: Google OAuth Callback (Redirect flow)
router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google_auth_failed`
  }),
  (req, res) => {
    try {
      // Generate JWT token
      const token = generateToken(req.user._id);
      
      // Redirect to frontend with token
      const redirectUrl = `${process.env.CLIENT_URL}/auth-success?token=${token}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
    }
  }
);

// Route 3: Google Token Exchange (For frontend Google SDK with access_token)
router.post('/google/token', async (req, res) => {
  try {
    const { access_token, userInfo } = req.body;
    
    console.log('📥 Received access_token:', access_token ? 'Present' : 'Missing');
    console.log('📥 Received userInfo:', userInfo ? 'Present' : 'Missing');
    
    // 🔥 FIX: Access token se verify karo
    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'Access token is required'
      });
    }
    
    // 🔥 FIX: User info already frontend se aa raha hai
    let userData = userInfo;
    
    // Agar userInfo nahi aaya toh API call karo
    if (!userData) {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }
      
      userData = await response.json();
    }
    
    console.log('👤 User Data:', userData);
    
    // Find or create user
    let user = await User.findOne({ googleId: userData.sub });
    
    if (!user) {
      user = await User.findOne({ email: userData.email });
      
      if (user) {
        user.googleId = userData.sub;
        user.authProvider = 'google';
        user.isEmailVerified = true;
        user.profilePicture = userData.picture || user.profilePicture;
        user.lastLogin = new Date();
        user.loginCount += 1;
        await user.save();
      } else {
        const nameParts = userData.name.split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';

        user = new User({
          firstName,
          lastName,
          email: userData.email,
          googleId: userData.sub,
          authProvider: 'google',
          profilePicture: userData.picture || null,
          isEmailVerified: true,
          isActive: true,
          lastLogin: new Date(),
          loginCount: 1
        });
        await user.save();
      }
    } else {
      user.lastLogin = new Date();
      user.loginCount += 1;
      await user.save();
    }
    
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePicture: user.profilePicture,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('❌ Google token exchange error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Invalid Google token'
    });
  }
});

// Protected routes (Need authentication)
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/update-profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/stats', protect, getStudentStats);

module.exports = router;