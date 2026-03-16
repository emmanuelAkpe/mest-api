const mongoose = require('mongoose');

const evaluationInsightSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, unique: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const EvaluationInsight = mongoose.model('EvaluationInsight', evaluationInsightSchema);
module.exports = EvaluationInsight;
