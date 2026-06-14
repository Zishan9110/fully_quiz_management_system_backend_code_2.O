// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'refunded'], 
    default: 'pending' 
  },
  paidAt: Date,
  refundedAt: Date,
  refundReason: String
}, { timestamps: true });

// Index for faster queries
paymentSchema.index({ student: 1, course: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);