const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const {
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  createAdmin
} = require('../controllers/adminAuthController');

// Public routes (No authentication needed)
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Protected routes (Need authentication)
router.post('/logout', protectAdmin, logout);
router.get('/me', protectAdmin, getMe);
router.put('/change-password', protectAdmin, changePassword);
router.post('/create', protectAdmin, createAdmin);


module.exports = router;