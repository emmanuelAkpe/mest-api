const mongoose = require('mongoose');

const SCALE_TYPES = ['1_to_5', '1_to_10', 'percentage', 'custom'];
const APPLIES_TO = ['team', 'individual', 'both'];

const rubricItemSchema = new mongoose.Schema(
  {
    score: { type: Number, required: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const kpiSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    weight: { type: Number, required: true, min: 0 },
    scaleType: { type: String, enum: SCALE_TYPES, required: true },
    scaleMin: { type: Number },
    scaleMax: { type: Number },
    appliesTo: { type: String, enum: APPLIES_TO, default: 'team' },
    requireComment: { type: Boolean, default: false },
    showRecommendation: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    rubric: { type: [rubricItemSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

const KPI = mongoose.model('KPI', kpiSchema);
module.exports = KPI;
