const mongoose = require('mongoose');

const FILE_TYPES = ['video', 'pdf', 'image', 'slides', 'spreadsheet', 'document', 'link', 'demo'];

const submissionItemSchema = new mongoose.Schema(
  {
    fileType:          { type: String, enum: FILE_TYPES, required: true },
    url:               { type: String, required: true },
    filename:          { type: String },
    label:             { type: String },
    submittedByEmail:  { type: String, required: true },
    submittedAt:       { type: Date, default: Date.now },
  },
  { _id: true }
);

const accessSessionSchema = new mongoose.Schema(
  {
    email:         { type: String, required: true },
    otpHash:       { type: String },
    otpExpiresAt:  { type: Date },
    sessionToken:  { type: String },
    grantedAt:     { type: Date },
  },
  { _id: false }
);

const submissionLinkSchema = new mongoose.Schema(
  {
    token:          { type: String, required: true, unique: true, immutable: true },
    event:          { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    team:           { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    deliverable:    { type: mongoose.Schema.Types.ObjectId, ref: 'Deliverable' },
    title:          { type: String, required: true, trim: true },
    description:    { type: String, trim: true },
    acceptedTypes:  [{ type: String, enum: FILE_TYPES }],
    deadline:       { type: Date, required: true },
    submissions:    [submissionItemSchema],
    accessSessions: { type: [accessSessionSchema], select: false },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

submissionLinkSchema.virtual('status').get(function () {
  const hasSubmissions = this.submissions.length > 0;
  if (hasSubmissions) return 'submitted';
  if (new Date() > this.deadline) return 'late';
  return 'pending';
});

submissionLinkSchema.set('toJSON', { virtuals: true });
submissionLinkSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SubmissionLink', submissionLinkSchema);
