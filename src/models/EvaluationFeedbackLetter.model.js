const mongoose = require('mongoose')

const schema = new mongoose.Schema(
  {
    team:   { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    event:  { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    letter:    { type: String, required: true },
    aiSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    sentAt:    { type: Date },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
)

schema.index({ team: 1, event: 1 }, { unique: true })

module.exports = mongoose.model('EvaluationFeedbackLetter', schema)
