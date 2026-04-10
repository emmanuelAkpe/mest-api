const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainee', required: true },
  email: { type: String, required: true, lowercase: true },
  otpHash: { type: String, select: false },
  otpExpiresAt: { type: Date, select: false },
  sessionToken: { type: String, select: false },
  grantedAt: { type: Date },
  expiresAt: { type: Date, required: true },
})

schema.index({ sessionToken: 1 }, { sparse: true })
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('TraineePortalSession', schema)
