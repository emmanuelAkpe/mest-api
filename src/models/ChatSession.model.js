const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatSessionSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    title: { type: String, default: 'New Conversation' },
    messages: [messageSchema],
  },
  { timestamps: true }
);

// Auto-title from first user message (truncate to 60 chars)
chatSessionSchema.pre('save', function () {
  if (
    this.messages.length === 1 &&
    this.messages[0].role === 'user' &&
    this.title === 'New Conversation'
  ) {
    this.title =
      this.messages[0].content.slice(0, 60) +
      (this.messages[0].content.length > 60 ? '…' : '');
  }
});

module.exports = mongoose.model('ChatSession', chatSessionSchema);
