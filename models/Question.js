const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text:      { type: String, required: true },
  isCorrect: { type: Boolean, default: false }
}, { _id: true });

const questionSchema = new mongoose.Schema({
  quiz:        { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  text:        { type: String, required: true },
  type:        {
    type: String,
    enum: ['multiple_choice', 'single_choice', 'true_false', 'fill_blank', 'short_answer'],
    required: true
  },
  options:     [optionSchema],
  correctAnswer: { type: String, default: null },
  explanation: { type: String, default: '' },
  marks:       { type: Number, required: true, default: 1 },
  difficulty:  { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  subject:     { type: String, default: '' },
  topic:       { type: String, default: '' },
  image:       { type: String, default: null },
  order:       { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true }
}, { timestamps: true });

questionSchema.index({ quiz: 1, order: 1 });
questionSchema.index({ difficulty: 1, subject: 1 });

module.exports = mongoose.model('Question', questionSchema);
