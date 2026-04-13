const mongoose = require('mongoose');

const mentorSessionSchema = new mongoose.Schema(
  {
    team:        { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    cohort:      { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    mentor:      { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    sessionDate: { type: Date, required: true },
    notes:       { type: String, trim: true },
    actionItems: [{ type: String, trim: true }],
    loggedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

const MentorSession = mongoose.model('MentorSession', mentorSessionSchema);
module.exports = MentorSession;
