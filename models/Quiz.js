const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  description:  { type: String, default: '' },
  course:       { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  questions:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  totalMarks:   { type: Number, default: 0 },
  passingMarks: { type: Number, default: 0 },
  duration:     { type: Number, required: true },
  attemptsAllowed: { type: Number, default: 1 },
  shuffleQuestions: { type: Boolean, default: false },
  shuffleOptions:   { type: Boolean, default: false },
  showResult:       { type: Boolean, default: true },
  showAnswers:      { type: Boolean, default: false },
  status:   { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  type:     { type: String, enum: ['practice', 'exam', 'assignment'], default: 'exam' },
  schedule: {
    startDate: { type: Date, default: null },
    endDate:   { type: Date, default: null }
  },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  instructions: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, toJSON: { virtuals: true } });

quizSchema.virtual('questionCount').get(function() {
  return Array.isArray(this.questions)
    ? this.questions.length
    : 0;
});

quizSchema.index({ status: 1, 'schedule.startDate': 1, 'schedule.endDate': 1 });
quizSchema.index({ course: 1 });

module.exports = mongoose.model('Quiz', quizSchema);
