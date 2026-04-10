const mongoose = require('mongoose');

const profileCompletionTokenSchema = new mongoose.Schema(
  {
    trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainee', required: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
    completedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

const ProfileCompletionToken = mongoose.model('ProfileCompletionToken', profileCompletionTokenSchema);
module.exports = ProfileCompletionToken;
