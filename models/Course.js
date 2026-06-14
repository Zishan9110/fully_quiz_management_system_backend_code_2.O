// models/Course.js
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  code: { 
    type: String, 
    unique: true, 
    sparse: true,
    default: undefined
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  thumbnail: { type: String, default: null },
  category: { type: String, required: true },
  instructor: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  isPublished: { type: Boolean, default: false },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  quizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }],
  duration: { type: Number, default: 0 },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  tags: [String],
  isActive: { type: Boolean, default: true },
  
  // 🔥 NEW PAYMENT FIELDS
  isPaid: { type: Boolean, default: false },
  price: { 
    type: Number, 
    default: 0,
    min: 0,
    validate: {
      validator: function(value) {
        if (this.isPaid && value <= 0) return false;
        return true;
      },
      message: 'Paid courses must have a price greater than 0'
    }
  },
  currency: { type: String, default: 'USD', enum: ['USD', 'INR', 'EUR', 'GBP'] },
  discountPrice: { 
    type: Number,
    min: 0,
    validate: {
      validator: function(value) {
        return !value || value < this.price;
      },
      message: 'Discount price must be less than original price'
    }
  }
}, { timestamps: true, toJSON: { virtuals: true } });

courseSchema.index({ code: 1 }, { unique: true, sparse: true });
courseSchema.index({ category: 1, isPublished: 1 });
courseSchema.index({ price: 1, isPaid: 1 }); // For payment queries

courseSchema.virtual('studentCount').get(function() {
  return this.students.length;
});

courseSchema.virtual('finalPrice').get(function() {
  return this.discountPrice || this.price;
});

module.exports = mongoose.model('Course', courseSchema);