const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName:  { type: String, required: true, trim: true, maxlength: 50 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 8, select: false },
  role:      { type: String, enum: ['student'], default: 'student' },
  profilePicture: { type: String, default: null },
  phone:     { type: String, default: null },
  dateOfBirth: { type: Date, default: null },
  address:   { type: String, default: null },
  courses:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  isEmailVerified: { type: Boolean, default: false },
  isActive:  { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  suspendReason: { type: String, default: null },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  // refreshToken: { type: String, select: false },
  lastLogin: Date,
  loginCount: { type: Number, default: 0 },
  preferences: {
    darkMode: { type: Boolean, default: false },
    language: { type: String, default: 'en' },
    notifications: {
      email: { type: Boolean, default: true },
      push:  { type: Boolean, default: true }
    }
  }
}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ isActive: 1, isSuspended: 1 });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Match password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
