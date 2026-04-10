const mongoose = require('mongoose')

const schema = new mongoose.Schema(
  {
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    generatedAt: { type: Date, required: true },
    model: { type: String, required: true },
    healthScore: { type: Number, min: 0, max: 100 },
    summary: { type: String },
    urgentActions: [{ priority: String, action: String, reason: String }],
    teamHealth: [{
      teamId: mongoose.Schema.Types.ObjectId,
      teamName: String,
      status: { type: String, enum: ['thriving', 'on_track', 'at_risk', 'critical'] },
      score: Number,
      note: String,
    }],
    coachingPrompts: [{
      teamId: mongoose.Schema.Types.ObjectId,
      teamName: String,
      prompt: String,
      focusArea: String,
    }],
    resourceRecommendations: [{ topic: String, rationale: String, targetTeams: [String] }],
    highlights: [new mongoose.Schema({ type: { type: String }, text: String }, { _id: false })],
  },
  { timestamps: true }
)

schema.index({ cohort: 1, createdAt: -1 })

module.exports = mongoose.model('ProgrammeBriefing', schema)
