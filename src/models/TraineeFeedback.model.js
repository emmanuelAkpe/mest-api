const mongoose = require('mongoose');

const FEEDBACK_TYPES = ['mentor', 'programme', 'peer'];

const ratingSchema = new mongoose.Schema(
  {
    area:  { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 1, max: 5 },
  },
  { _id: false }
);

const traineeFeedbackSchema = new mongoose.Schema(
  {
    trainee:     { type: mongoose.Schema.Types.ObjectId, ref: 'Trainee', required: true, index: true },
    cohort:      { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    type:        { type: String, enum: FEEDBACK_TYPES, required: true },
    // mentor → Admin._id | peer → Trainee._id | programme → null
    target:      { type: mongoose.Schema.Types.ObjectId, default: null },
    targetModel: { type: String, enum: ['Admin', 'Trainee', null], default: null },
    ratings:     { type: [ratingSchema], default: [] },
    comment:     { type: String, trim: true },
  },
  { timestamps: true }
);

// One feedback entry per trainee per type+target (upsertable)
traineeFeedbackSchema.index({ trainee: 1, type: 1, target: 1 }, { unique: true });

const TraineeFeedback = mongoose.model('TraineeFeedback', traineeFeedbackSchema);
module.exports = TraineeFeedback;
