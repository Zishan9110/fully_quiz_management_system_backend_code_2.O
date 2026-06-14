// routes/courses.js
const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const {
  createCourse, 
  getCourses, 
  getCourse, 
  updateCourse, 
  deleteCourse,
  publishCourse, 
  assignStudents, 
  getStudentCourses,
  getAvailableCourses,
  getCourseWithPurchaseStatus,
  getPublicCourses  // 🔥 NEW - Add this import
} = require('../controllers/courseController');

// ============ PUBLIC ROUTES (No Auth Required) ============
router.get('/public', getPublicCourses);  // 🔥 NEW - Everyone can see courses

// ============ ADMIN ROUTES ============
router.post('/', protectAdmin, createCourse);
router.get('/admin', protectAdmin, getCourses);
router.get('/admin/:id', protectAdmin, getCourse);
router.put('/:id', protectAdmin, updateCourse);
router.delete('/:id', protectAdmin, deleteCourse);
router.put('/:id/publish', protectAdmin, publishCourse);
router.put('/:id/assign-students', protectAdmin, assignStudents);

// ============ STUDENT ROUTES (Need Login) ============
router.get('/my-courses', protect, getStudentCourses);
router.get('/available', protect, getAvailableCourses);
router.get('/:id', protect, getCourseWithPurchaseStatus);

module.exports = router;