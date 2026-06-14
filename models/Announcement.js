const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true },
  content:   { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  targetType: { type: String, enum: ['all', 'course', 'specific'], default: 'all' },
  targetCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  targetStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive:  { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  priority:  { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  readBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

announcementSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
