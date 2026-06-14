// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPurchaseHistory,
  getPaymentDetails,
  getAllPayments,
  getPaymentStats,
  processRefund,
  handleRazorpayWebhook
} = require('../controllers/paymentController');

// Optional webhook (can be removed if not needed)
router.post('/webhook', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

// Student routes
router.post('/create-order', protect, createRazorpayOrder);
router.post('/verify-payment', protect, verifyRazorpayPayment);
router.get('/my-purchases', protect, getPurchaseHistory);
router.get('/:id', protect, getPaymentDetails);

// Admin routes
router.get('/admin/all', protectAdmin, getAllPayments);
router.get('/admin/stats', protectAdmin, getPaymentStats);
router.post('/admin/refund', protectAdmin, processRefund);

module.exports = router;