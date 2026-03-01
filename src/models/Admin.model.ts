import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env';

export type AdminRole = 'super_admin' | 'program_admin';

export interface IAdmin extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: AdminRole;
  isActive: boolean;
  lastLogin?: Date;
  refreshTokens: string[];
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidate: string): Promise<boolean>;
  isTokenIssuedBeforePasswordChange(jwtIat: number): boolean;
}

interface IAdminModel extends Model<IAdmin> {
  findByEmail(email: string): Promise<IAdmin | null>;
}

const adminSchema = new Schema<IAdmin>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['super_admin', 'program_admin'], default: 'program_admin' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    refreshTokens: { type: [String], default: [] },
    passwordChangedAt: { type: Date, select: false },
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

adminSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

adminSchema.methods.isTokenIssuedBeforePasswordChange = function (jwtIat: number): boolean {
  if (!this.passwordChangedAt) return false;
  const changedAt = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return jwtIat < changedAt;
};

adminSchema.statics.findByEmail = function (email: string): Promise<IAdmin | null> {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

const Admin = mongoose.model<IAdmin, IAdminModel>('Admin', adminSchema);
export default Admin;
