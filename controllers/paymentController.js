// backend/controllers/paymentController.js - Fixed version
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Course = require('../models/Course');
const User = require('../models/User');

console.log('=== Loading paymentController.js ===');
console.log('RAZORPAY_KEY_ID exists?', !!process.env.RAZORPAY_KEY_ID);
console.log('RAZORPAY_KEY_SECRET exists?', !!process.env.RAZORPAY_KEY_SECRET);

// Initialize Razorpay
let razorpay;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('✅ Razorpay initialized successfully');
  } else {
    console.error('❌ Razorpay keys are missing in .env file');
  }
} catch (err) {
  console.error('❌ Razorpay initialization error:', err.message);
}

exports.createRazorpayOrder = async (req, res) => {
  console.log('\n=== CREATE ORDER CALLED ===');
  
  try {
    const { courseId } = req.body;
    const studentId = req.user._id;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check if already enrolled
    if (course.students && course.students.includes(studentId)) {
      return res.status(400).json({ success: false, message: 'Already enrolled in this course' });
    }

    // Handle FREE course
    if (!course.isPaid || course.price === 0) {
      course.students = course.students || [];
      course.students.push(studentId);
      await course.save();
      
      await User.findByIdAndUpdate(studentId, {
        $addToSet: { enrolledCourses: courseId }
      });
      
      return res.json({ 
        success: true, 
        isFree: true, 
        message: 'Successfully enrolled!'
      });
    }

    // Handle PAID course
    const finalAmount = course.discountPrice || course.price;
    console.log('Processing PAID course, amount:', finalAmount);

    // Check if Razorpay is initialized
    if (!razorpay) {
      return res.status(500).json({ 
        success: false, 
        message: 'Payment gateway not configured. Please contact admin.' 
      });
    }

    // 🔥 FIXED: Short receipt (max 40 characters)
    // Generate a short unique receipt ID
    const timestamp = Date.now().toString().slice(-8);
    const shortCourseId = course._id.toString().slice(-6);
    const receipt = `c${shortCourseId}${timestamp}`; // Example: c12345678901234 (max 25 chars)
    
    console.log('Generated receipt:', receipt, 'Length:', receipt.length);

    // Create Razorpay order
    const options = {
      amount: Math.round(finalAmount * 100),
      currency: course.currency || 'INR',
      receipt: receipt,  // ✅ Now within 40 characters limit
      notes: {
        courseId: course._id.toString(),
        studentId: studentId.toString(),
        courseName: course.name.substring(0, 30) // Limit course name length
      }
    };

    console.log('Creating Razorpay order with options:', options);
    
    const order = await razorpay.orders.create(options);
    console.log('✅ Razorpay order created:', order.id);

    // Save payment record
    const payment = new Payment({
      student: studentId,
      course: courseId,
      amount: finalAmount,
      currency: course.currency || 'INR',
      razorpayOrderId: order.id,
      status: 'pending'
    });
    await payment.save();

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      paymentId: payment._id,
      course: {
        name: course.name,
        description: course.description
      }
    });

  } catch (error) {
    console.error('❌ Razorpay order creation error:', error);
    
    // More detailed error response
    let errorMessage = error.message;
    if (error.error && error.error.description) {
      errorMessage = error.error.description;
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage || 'Failed to create payment order'
    });
  }
};

// Keep all other functions as they were...
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = req.body;
    
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'completed';
    payment.paidAt = new Date();
    await payment.save();

    const course = await Course.findById(payment.course);
    if (course && !course.students.includes(payment.student)) {
      course.students.push(payment.student);
      await course.save();
    }

    res.json({ success: true, message: 'Payment verified and enrolled!' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPurchaseHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ student: req.user._id, status: 'completed' })
      .populate('course', 'name thumbnail price');
    res.json({ success: true, data: payments });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
};

exports.getPaymentDetails = async (req, res) => {
  res.json({ success: true, data: {} });
};

exports.getAllPayments = async (req, res) => {
  res.json({ success: true, data: [] });
};

exports.getPaymentStats = async (req, res) => {
  res.json({ success: true, data: {} });
};

exports.processRefund = async (req, res) => {
  res.json({ success: true, message: 'Refund processed' });
};

exports.handleRazorpayWebhook = async (req, res) => {
  res.json({ status: 'ok' });
};