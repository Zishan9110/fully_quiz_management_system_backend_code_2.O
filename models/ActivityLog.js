const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  actor:      { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'actorModel' },
  actorModel: { type: String, required: true, enum: ['User', 'Admin'] },
  action:     { type: String, required: true },
  resource:   { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  details:    { type: String, default: '' },
  ipAddress:  { type: String, default: null },
  userAgent:  { type: String, default: null },
  status:     { type: String, enum: ['success', 'failure'], default: 'success' }
}, { timestamps: true });

activityLogSchema.index({ actor: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, resource: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
