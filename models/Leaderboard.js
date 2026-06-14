const mongoose = require('mongoose');

const leaderboardEntrySchema = new mongoose.Schema({
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quiz:        { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', default: null },
  course:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  score:       { type: Number, required: true },
  percentage:  { type: Number, required: true },
  rank:        { type: Number, required: true },
  type:        { type: String, enum: ['global', 'monthly', 'weekly', 'course'], default: 'global' },
  period:      { type: String, default: null },
  timeTaken:   { type: Number, default: 0 }
}, { timestamps: true });

leaderboardEntrySchema.index({ type: 1, rank: 1 });
leaderboardEntrySchema.index({ student: 1, type: 1 });
leaderboardEntrySchema.index({ course: 1, type: 1 });

module.exports = mongoose.model('Leaderboard', leaderboardEntrySchema);
