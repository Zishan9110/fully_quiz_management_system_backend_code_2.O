const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, minlength: 8, select: false },
  role:      { type: String, enum: ['super_admin', 'admin'], default: 'admin' },
  profilePicture: { type: String, default: null },
  phone:     { type: String, default: null },
  isActive:  { type: Boolean, default: true },
  
  // 🔥 GOOGLE & APPROVAL FIELDS
  googleId: { type: String, sparse: true, unique: true },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approvedAt: { type: Date },
  registrationMethod: { type: String, enum: ['email', 'google'], default: 'email' },
  
  permissions: {
    manageStudents: { type: Boolean, default: true },
    manageQuizzes:  { type: Boolean, default: true },
    manageCourses:  { type: Boolean, default: true },
    manageAdmins:   { type: Boolean, default: false },
    viewReports:    { type: Boolean, default: true },
    manageSettings: { type: Boolean, default: false }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  lastLogin: Date
}, { timestamps: true });

// Hash password only if modified and exists
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

adminSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

adminSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Admin', adminSchema);