const Announcement = require('../models/Announcement');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');

exports.createAnnouncement = asyncHandler(async (req, res) => {
  req.body.createdBy = req.admin._id;
  const ann = await Announcement.create(req.body);
  res.status(201).json({ success: true, data: ann });
});

exports.getAnnouncements = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, isActive } = req.query;
  const query = {};
  if (isActive !== undefined) query.isActive = isActive === 'true';
  const total = await Announcement.countDocuments(query);
  const anns = await Announcement.find(query)
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit).limit(Number(limit));
  res.json({ success: true, total, data: anns });
});

exports.getAnnouncement = asyncHandler(async (req, res, next) => {
  const ann = await Announcement.findById(req.params.id);
  if (!ann) return next(new ErrorResponse('Announcement not found', 404));
  res.json({ success: true, data: ann });
});

exports.updateAnnouncement = asyncHandler(async (req, res, next) => {
  const ann = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!ann) return next(new ErrorResponse('Announcement not found', 404));
  res.json({ success: true, data: ann });
});

exports.deleteAnnouncement = asyncHandler(async (req, res, next) => {
  const ann = await Announcement.findByIdAndDelete(req.params.id);
  if (!ann) return next(new ErrorResponse('Announcement not found', 404));
  res.json({ success: true, message: 'Deleted' });
});

exports.getStudentAnnouncements = asyncHandler(async (req, res) => {
  const now = new Date();
  const anns = await Announcement.find({
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    $or: [
      { targetType: 'all' },
      { targetType: 'specific', targetStudents: req.user._id },
      { targetType: 'course', targetCourse: { $in: req.user.courses } }
    ]
  }).sort({ priority: -1, createdAt: -1 }).limit(20);
  res.json({ success: true, data: anns });
});

exports.markRead = asyncHandler(async (req, res) => {
  await Announcement.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: req.user._id } });
  res.json({ success: true });
});
