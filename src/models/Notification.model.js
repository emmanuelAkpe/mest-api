const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'submission_received',
        'evaluation_submitted',
        'mentor_review_added',
        'ai_review_ready',
        'deadline_approaching',
        'ai_programme_briefing',
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String, default: null },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
)

notificationSchema.index({ createdAt: -1 })
notificationSchema.index({ isRead: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema)
