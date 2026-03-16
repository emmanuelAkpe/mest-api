const mongoose = require('mongoose');

const ROLES = ['team_lead', 'cto', 'product', 'business', 'design', 'marketing', 'finance', 'data_ai', 'presenter'];
const CHANGE_TYPES = ['joined', 'left', 'role_changed'];

const memberChangeSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainee', required: true },
    changeType: { type: String, enum: CHANGE_TYPES, required: true },
    previousRoles: [{ type: String, enum: ROLES }],
    newRoles: [{ type: String, enum: ROLES }],
    reason: { type: String, trim: true },
    destinationTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

const MemberChange = mongoose.model('MemberChange', memberChangeSchema);
module.exports = MemberChange;
