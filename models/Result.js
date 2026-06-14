const mongoose = require('mongoose');

const subjectAnalysisSchema = new mongoose.Schema({
  subject: String,
  total: Number,
  correct: Number,
  percentage: Number
}, { _id: false });

const resultSchema = new mongoose.Schema({
  attempt:     { type: mongoose.Schema.Types.ObjectId, ref: 'QuizAttempt', required: true, unique: true },
  quiz:        { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  totalMarks:  { type: Number, required: true },
  marksObtained: { type: Number, required: true },
  percentage:  { type: Number, required: true },
  correctAnswers: { type: Number, default: 0 },
  wrongAnswers:   { type: Number, default: 0 },
  skippedAnswers: { type: Number, default: 0 },
  isPassed:    { type: Boolean, default: false },
  rank:        { type: Number, default: null },
  subjectAnalysis: [subjectAnalysisSchema],
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
  timeTaken:   { type: Number, default: 0 }
}, { timestamps: true });

resultSchema.index({ quiz: 1, student: 1 });
resultSchema.index({ student: 1, createdAt: -1 });
resultSchema.index({ quiz: 1, percentage: -1 });

module.exports = mongoose.model('Result', resultSchema);
