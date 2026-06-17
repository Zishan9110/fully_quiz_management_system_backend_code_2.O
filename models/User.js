const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName:  { type: String, required: true, trim: true, maxlength: 50 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, minlength: 8, select: false }, // ⚠️ Changed: not required for Google users
  
  // 🔥 ADD THESE FIELDS FOR GOOGLE LOGIN
  googleId: { 
    type: String, 
    unique: true, 
    sparse: true, // Allows null values
    index: true 
  },
  authProvider: { 
    type: String, 
    enum: ['local', 'google'], 
    default: 'local' 
  },
  profilePicture: { 
    type: String, 
    default: null 
  },
  isEmailVerified: { 
    type: Boolean, 
    default: false 
  },
  
  // Rest of your existing fields...
  role: { type: String, enum: ['student'], default: 'student' },
  phone: { type: String, default: null },
  dateOfBirth: { type: Date, default: null },
  address: { type: String, default: null },
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  isActive: { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  suspendReason: { type: String, default: null },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  lastLogin: Date,
  loginCount: { type: Number, default: 0 },
  preferences: {
    darkMode: { type: Boolean, default: false },
    language: { type: String, default: 'en' },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  }
}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }); // 🔥 ADD THIS
userSchema.index({ isActive: 1, isSuspended: 1 });

// Hash password before save - only if password exists
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
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
