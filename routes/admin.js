const express = require('express');
const router = express.Router();
const { protectAdmin, authorize, requirePermission } = require('../middleware/auth');
const {
  getDashboardStats, getStudents, getStudent, createStudent,
  updateStudent, deleteStudent, suspendStudent, unsuspendStudent,
  importStudents, exportStudents
} = require('../controllers/adminController');

router.use(protectAdmin);
router.get('/dashboard', getDashboardStats);
router.get('/students', requirePermission('manageStudents'), getStudents);
router.get('/students/export', exportStudents);
router.post('/students/import', importStudents);
router.get('/students/:id', getStudent);
router.post('/students', createStudent);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', authorize('super_admin'), deleteStudent);
router.put('/students/:id/suspend', suspendStudent);
router.put('/students/:id/unsuspend', unsuspendStudent);
module.exports = router;
