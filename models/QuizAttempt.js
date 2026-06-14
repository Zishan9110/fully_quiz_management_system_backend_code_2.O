const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  question:      { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  selectedOption: { type: mongoose.Schema.Types.ObjectId, default: null },
  textAnswer:    { type: String, default: null },
  isCorrect:     { type: Boolean, default: false },
  marksObtained: { type: Number, default: 0 },
  timeSpent:     { type: Number, default: 0 },
  isMarkedForReview: { type: Boolean, default: false }
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema({
  quiz:       { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers:    [answerSchema],
  status:     { type: String, enum: ['in_progress', 'submitted', 'timed_out', 'abandoned'], default: 'in_progress' },
  startTime:  { type: Date, default: Date.now },
  endTime:    { type: Date, default: null },
  timeSpent:  { type: Number, default: 0 },
  score:      { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  isPassed:   { type: Boolean, default: false },
  attemptNumber: { type: Number, default: 1 },
  ipAddress:  { type: String, default: null },
  userAgent:  { type: String, default: null }
}, { timestamps: true });

quizAttemptSchema.index({ quiz: 1, student: 1 });
quizAttemptSchema.index({ student: 1, status: 1 });
quizAttemptSchema.index({ createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
