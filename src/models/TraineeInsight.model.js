const mongoose = require('mongoose');

const traineeInsightSchema = new mongoose.Schema(
  {
    trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainee', required: true, unique: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const TraineeInsight = mongoose.model('TraineeInsight', traineeInsightSchema);
module.exports = TraineeInsight;
