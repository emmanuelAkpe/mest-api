const mongoose = require('mongoose');

const ROLES = ['team_lead', 'cto', 'product', 'business', 'design', 'marketing', 'finance', 'data_ai', 'presenter'];
const PIVOT_TYPES = ['product_idea', 'target_market', 'business_model', 'technical_approach', 'multiple'];

const memberSchema = new mongoose.Schema(
  {
    trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainee', required: true },
    roles: [{ type: String, enum: ROLES }],
  },
  { _id: false }
);

const pivotSchema = new mongoose.Schema(
  {
    type: { type: String, enum: PIVOT_TYPES, required: true },
    description: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
    wasProactive: { type: Boolean },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

const teamSchema = new mongoose.Schema(
  {
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    parentTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    name: { type: String, required: true, trim: true },
    productIdea: { type: String, trim: true },
    marketFocus: { type: String, trim: true },
    members: [memberSchema],
    pivots: [pivotSchema],
    isDissolved: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

teamSchema.index({ 'members.trainee': 1 });

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;
