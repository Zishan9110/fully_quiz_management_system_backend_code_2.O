const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender:     { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'senderModel' },
  senderModel:{ type: String, required: true, enum: ['User', 'Admin'] },
  receiver:   { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'receiverModel' },
  receiverModel:{ type: String, required: true, enum: ['User', 'Admin'] },
  content:    { type: String, required: true },
  isRead:     { type: Boolean, default: false },
  readAt:     { type: Date, default: null },
  isBroadcast:{ type: Boolean, default: false },
  attachments:[{ name: String, url: String, type: String }],
  conversationId: { type: String, required: true }
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ receiver: 1, isRead: 1 });

module.exports = mongoose.model('Message', messageSchema);
