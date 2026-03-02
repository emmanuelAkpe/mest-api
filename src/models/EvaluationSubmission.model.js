const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema(
  {
    kpi: { type: mongoose.Schema.Types.ObjectId, ref: 'KPI', required: true },
    score: { type: Number, required: true },
    comment: { type: String, trim: true },
    recommendation: { type: String, trim: true },
  },
  { _id: false }
);

const teamScoreSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    scores: [scoreSchema],
    overallComment: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const evaluationSubmissionSchema = new mongoose.Schema(
  {
    link: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationLink', required: true, unique: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    evaluatorName: { type: String, trim: true },
    evaluatorEmail: { type: String, trim: true },
    teamScores: [teamScoreSchema],
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

const EvaluationSubmission = mongoose.model('EvaluationSubmission', evaluationSubmissionSchema);
module.exports = EvaluationSubmission;
