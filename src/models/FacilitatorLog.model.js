const mongoose = require('mongoose');

const facilitatorLogSchema = new mongoose.Schema(
  {
    trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainee', required: true, index: true },
    facilitator: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    note: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const FacilitatorLog = mongoose.model('FacilitatorLog', facilitatorLogSchema);
module.exports = FacilitatorLog;
