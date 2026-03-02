const mongoose = require('mongoose');

const cohortSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    description: { type: String, trim: true },
    isArchived: { type: Boolean, default: false },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

// Prevent duplicate cohort names within the same year
cohortSchema.index({ name: 1, year: 1 }, { unique: true });

const Cohort = mongoose.model('Cohort', cohortSchema);
module.exports = Cohort;
