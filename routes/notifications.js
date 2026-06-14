const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const { getMyNotifications, markRead, markAllRead, deleteNotification, createNotification } = require('../controllers/notificationController');

router.get('/my', protect, getMyNotifications);
router.put('/:id/read', protect, markRead);
router.put('/mark-all-read', protect, markAllRead);
router.delete('/:id', protect, deleteNotification);
router.post('/', protectAdmin, createNotification);
module.exports = router;
