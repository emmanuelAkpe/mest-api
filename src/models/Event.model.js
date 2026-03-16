const mongoose = require('mongoose');

const EVENT_TYPES = ['startup_build', 'newco', 'class_workshop', 'internal_review', 'demo_pitch_day', 'other'];

const eventSchema = new mongoose.Schema(
  {
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    parentEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    description: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
