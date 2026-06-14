const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
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

// Protected routes (Need authentication)
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/update-profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/stats', protect, getStudentStats);

module.exports = router;