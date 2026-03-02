const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { env } = require('../config/env');

const adminSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    role: { type: String, enum: ['super_admin', 'program_admin'], default: 'program_admin' },
    isActive: { type: Boolean, default: false },
    lastLogin: { type: Date },
    refreshTokens: { type: [String], default: [] },
    passwordChangedAt: { type: Date, select: false },
    inviteToken: { type: String, select: false },
    inviteTokenExpiry: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false },
  },
  { timestamps: true }
);

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, env.BCRYPT_SALT_ROUNDS);
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }
  next();
});

adminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

adminSchema.methods.isTokenIssuedBeforePasswordChange = function (jwtIat) {
  if (!this.passwordChangedAt) return false;
  const changedAt = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return jwtIat < changedAt;
};

adminSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
