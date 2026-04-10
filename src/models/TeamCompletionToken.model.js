const mongoose = require('mongoose');

const teamCompletionTokenSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
    completedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

const TeamCompletionToken = mongoose.model('TeamCompletionToken', teamCompletionTokenSchema);
module.exports = TeamCompletionToken;
