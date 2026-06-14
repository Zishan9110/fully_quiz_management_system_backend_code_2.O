const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const {
  createAnnouncement, getAnnouncements, getAnnouncement,
  updateAnnouncement, deleteAnnouncement, getStudentAnnouncements, markRead
} = require('../controllers/announcementController');

router.post('/', protectAdmin, createAnnouncement);
router.get('/admin', protectAdmin, getAnnouncements);
router.get('/my', protect, getStudentAnnouncements);
router.get('/:id', getAnnouncement);
router.put('/:id', protectAdmin, updateAnnouncement);
router.delete('/:id', protectAdmin, deleteAnnouncement);
router.put('/:id/read', protect, markRead);
module.exports = router;
