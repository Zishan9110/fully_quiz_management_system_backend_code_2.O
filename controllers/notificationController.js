const Notification = require('../models/Notification');
const asyncHandler = require('../middleware/asyncHandler');

exports.getMyNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const query = { recipient: req.user._id };
  if (unreadOnly === 'true') query.isRead = false;

  const total = await Notification.countDocuments(query);
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  res.json({ success: true, total, unreadCount, data: notifications });
});

exports.markRead = asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true, readAt: new Date() }
  );
  res.json({ success: true, message: 'Marked as read' });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  res.json({ success: true, message: 'All notifications marked as read' });
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  res.json({ success: true, message: 'Notification deleted' });
});

exports.createNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.create(req.body);
  const { getIO } = require('../sockets');
  try {
    getIO().to(`user_${notification.recipient}`).emit('notification', notification);
  } catch {}
  res.status(201).json({ success: true, data: notification });
});
