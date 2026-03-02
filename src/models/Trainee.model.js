const mongoose = require('mongoose');

const SKILL_LEVELS = ['none', 'basic', 'intermediate', 'advanced'];

const traineeSchema = new mongoose.Schema(
  {
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    country: { type: String, required: true, trim: true },
    photo: { type: String, trim: true },
    bio: { type: String, trim: true },
    technicalBackground: { type: String, enum: SKILL_LEVELS, default: 'none' },
    aiSkillLevel: { type: String, enum: SKILL_LEVELS, default: 'none' },
    linkedIn: { type: String, trim: true },
    github: { type: String, trim: true },
    portfolio: { type: String, trim: true },
    entryScore: { type: Number, min: 0, max: 100 },
    notes: { type: String, trim: true, select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Trainee = mongoose.model('Trainee', traineeSchema);
module.exports = Trainee;
