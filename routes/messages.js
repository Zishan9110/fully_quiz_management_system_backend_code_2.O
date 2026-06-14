const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const { sendMessage, getConversation, getConversations, broadcastMessage } = require('../controllers/messageController');

router.post('/send', protect, sendMessage);
router.get('/conversations', protect, getConversations);
router.get('/conversation/:userId', protect, getConversation);
router.post('/admin/send', protectAdmin, sendMessage);
router.get('/admin/conversations', protectAdmin, getConversations);
router.get('/admin/conversation/:userId', protectAdmin, getConversation);
router.post('/admin/broadcast', protectAdmin, broadcastMessage);
module.exports = router;
