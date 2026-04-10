const mongoose = require('mongoose');

const mentorReviewSchema = new mongoose.Schema(
  {
    trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainee', required: true, index: true },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    content: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true }
);

const MentorReview = mongoose.model('MentorReview', mentorReviewSchema);
module.exports = MentorReview;
