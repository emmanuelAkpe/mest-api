const mongoose = require('mongoose');

const FILE_TYPES = ['video', 'pdf', 'image', 'slides', 'spreadsheet', 'document', 'link', 'demo'];

const aiTeamReviewSchema = new mongoose.Schema(
  {
    teamId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    teamName:         String,
    summary:          String,
    strengths:        [String],
    improvements:     [String],
    score:            Number,
    redFlags:         [String],
    skippedTypes:     [String],
    noContentWarning: Boolean,
  },
  { _id: false }
);

const deliverableSchema = new mongoose.Schema(
  {
    event:       { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    cohort:      { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    title:       { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    acceptedTypes: [{ type: String, enum: FILE_TYPES }],
    deadline:    { type: Date, required: true },
    targetType:  { type: String, enum: ['team', 'trainee'], default: 'team' },
    aiReview: {
      generatedAt: Date,
      model:       String,
      teams:       [aiTeamReviewSchema],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Deliverable', deliverableSchema);
