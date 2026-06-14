const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  group: { type: String, default: 'general' },
  description: { type: String, default: '' },
  isPublic: { type: Boolean, default: false }
}, { timestamps: true });

settingsSchema.index({ key: 1 });
settingsSchema.index({ group: 1 });

module.exports = mongoose.model('Settings', settingsSchema);
