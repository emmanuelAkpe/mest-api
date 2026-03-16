const mongoose = require('mongoose');

const LINK_STATUSES = ['not_opened', 'opened', 'submitted'];

const evaluationLinkSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    evaluatorName: { type: String, required: true, trim: true },
    evaluatorEmail: { type: String, trim: true },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    tokenHash: { type: String, required: true, select: false },
    evalUrl: { type: String },
    status: { type: String, enum: LINK_STATUSES, default: 'not_opened' },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

evaluationLinkSchema.index({ tokenHash: 1 }, { unique: true });

const EvaluationLink = mongoose.model('EvaluationLink', evaluationLinkSchema);
module.exports = EvaluationLink;
