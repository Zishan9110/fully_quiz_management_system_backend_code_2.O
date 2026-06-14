const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient:   { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'recipientModel' },
  recipientModel: { type: String, required: true, enum: ['User', 'Admin'] },
  type:        {
    type: String,
    enum: ['quiz_assigned', 'result_published', 'announcement', 'course_update',
           'message', 'system', 'reminder'],
    required: true
  },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  data:        { type: mongoose.Schema.Types.Mixed, default: {} },
  isRead:      { type: Boolean, default: false },
  readAt:      { type: Date, default: null },
  link:        { type: String, default: null }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
