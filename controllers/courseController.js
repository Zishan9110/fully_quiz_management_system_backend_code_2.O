// controllers/courseController.js
const Course = require('../models/Course');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');

exports.createCourse = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.admin._id;
  
  // Validate price for paid courses
  if (req.body.isPaid && (!req.body.price || req.body.price <= 0)) {
    return next(new ErrorResponse('Paid courses must have a price greater than 0', 400));
  }
  
  const course = await Course.create(req.body);
  res.status(201).json({ success: true, data: course });
});

exports.getCourses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, category, isPublished } = req.query;
  const query = {};
  if (search) query.name = { $regex: search, $options: 'i' };
  if (category) query.category = category;
  if (isPublished !== undefined) query.isPublished = isPublished === 'true';

  const total = await Course.countDocuments(query);
  const courses = await Course.find(query)
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: courses });
});

exports.getCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id)
    .populate('students', 'firstName lastName email')
    .populate('quizzes', 'title status type totalMarks');
  if (!course) return next(new ErrorResponse('Course not found', 404));
  res.json({ success: true, data: course });
});

exports.updateCourse = asyncHandler(async (req, res, next) => {
  // Remove sensitive fields that shouldn't be updated directly
  const updateData = { ...req.body };
  delete updateData.students; // Don't allow direct student array update
  delete updateData.createdBy; // Don't allow changing creator
  
  const course = await Course.findByIdAndUpdate(req.params.id, updateData, { 
    new: true, 
    runValidators: true 
  });
  if (!course) return next(new ErrorResponse('Course not found', 404));
  res.json({ success: true, data: course });
});

exports.deleteCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) return next(new ErrorResponse('Course not found', 404));
  res.json({ success: true, message: 'Course deleted' });
});

exports.publishCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { isPublished: true }, { new: true });
  if (!course) return next(new ErrorResponse('Course not found', 404));
  res.json({ success: true, data: course });
});

exports.assignStudents = asyncHandler(async (req, res, next) => {
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { students: { $each: req.body.studentIds } } },
    { new: true }
  );
  if (!course) return next(new ErrorResponse('Course not found', 404));
  res.json({ success: true, data: course });
});

exports.getStudentCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ students: req.user._id, isPublished: true })
    .populate('quizzes', 'title status type totalMarks')
    .select('-students');
  res.json({ success: true, data: courses });
});

// NEW: Get available courses for marketplace (with payment info)
exports.getAvailableCourses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, category, level } = req.query;
  const query = { isPublished: true };
  
  if (search) query.name = { $regex: search, $options: 'i' };
  if (category) query.category = category;
  if (level) query.level = level;
  
  const total = await Course.countDocuments(query);
  const courses = await Course.find(query)
    .select('name description thumbnail category instructor level isPaid price discountPrice currency studentCount')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  
  // Check which courses user is already enrolled in
  const enrolledCourseIds = await Course.find(
    { students: req.user._id },
    '_id'
  ).select('_id');
  
  const enrolledSet = new Set(enrolledCourseIds.map(c => c._id.toString()));
  
  const coursesWithStatus = courses.map(course => ({
    ...course.toJSON(),
    isEnrolled: enrolledSet.has(course._id.toString()),
    finalPrice: course.discountPrice || course.price,
    displayPrice: course.isPaid ? `${course.currency} ${course.discountPrice || course.price}` : 'Free'
  }));
  
  res.json({ 
    success: true, 
    total, 
    page: Number(page), 
    pages: Math.ceil(total / limit), 
    data: coursesWithStatus 
  });
});

// controllers/courseController.js - Add this function at the bottom

// Public route - Show all published courses (NO LOGIN REQUIRED)
exports.getPublicCourses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, category, level } = req.query;
  const query = { isPublished: true };
  
  if (search) query.name = { $regex: search, $options: 'i' };
  if (category) query.category = category;
  if (level) query.level = level;
  
  const total = await Course.countDocuments(query);
  const courses = await Course.find(query)
    .select('name description thumbnail category instructor level isPaid price discountPrice currency students')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  
  // For public view, just show course info (no enrollment status)
  const coursesWithInfo = courses.map(course => ({
    _id: course._id,
    name: course.name,
    description: course.description,
    thumbnail: course.thumbnail,
    category: course.category,
    instructor: course.instructor,
    level: course.level,
    isPaid: course.isPaid || false,
    price: course.price || 0,
    discountPrice: course.discountPrice,
    currency: course.currency || 'INR',
    finalPrice: course.discountPrice || course.price,
    studentCount: course.students?.length || 0,
    isFree: !course.isPaid || course.price === 0
  }));
  
  res.json({ 
    success: true, 
    total, 
    page: Number(page), 
    pages: Math.ceil(total / limit), 
    data: coursesWithInfo 
  });
});

// NEW: Get course details with purchase status
exports.getCourseWithPurchaseStatus = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id)
    .populate('students', 'firstName lastName email')
    .populate('quizzes', 'title status type totalMarks');
  
  if (!course) return next(new ErrorResponse('Course not found', 404));
  
  // Check if current student is enrolled
  const isEnrolled = course.students.some(s => 
    s._id.toString() === req.user._id.toString()
  );
  
  // Prepare payment info
  let paymentInfo = null;
  if (course.isPaid && course.price > 0) {
    paymentInfo = {
      isPaid: true,
      price: course.discountPrice || course.price,
      originalPrice: course.price,
      currency: course.currency,
      hasDiscount: !!course.discountPrice
    };
  }
  
  const response = {
    ...course.toJSON(),
    isEnrolled,
    paymentInfo
  };
  
  res.json({ success: true, data: response });
});

// backend/controllers/courseController.js - Update this function

exports.getStudentCourses = asyncHandler(async (req, res) => {
  try {
    const studentId = req.user._id;
    
    // Find courses where student is enrolled
    const courses = await Course.find({ 
      students: { $in: [studentId] },
      isPublished: true 
    })
    .populate('quizzes', 'title status type totalMarks')
    .select('-students'); // Remove students array from response
    
    // If no courses found, return empty array (not error)
    res.json({ success: true, data: courses || [] });
    
  } catch (error) {
    console.error('Error in getStudentCourses:', error);
    // Return empty array instead of error
    res.json({ success: true, data: [] });
  }
});