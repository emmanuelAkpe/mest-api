const Trainee = require('../models/Trainee.model');
const Cohort = require('../models/Cohort.model');
const MemberChange = require('../models/MemberChange.model');
const TraineeInsight = require('../models/TraineeInsight.model');
const MentorReview = require('../models/MentorReview.model');
const FacilitatorLog = require('../models/FacilitatorLog.model');
const ProfileCompletionToken = require('../models/ProfileCompletionToken.model');
const { generateTraineeInsightReport } = require('../services/mestAgent.service');
const { sendProfileCompletionEmail } = require('../services/email.service');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');
const { getIp, getUserAgent } = require('../utils/request');
const { generateRawToken, hashEvaluationToken } = require('../utils/tokenUtils');
const { env } = require('../config/env');
const { createNotification } = require('../services/notification.service');

function logTraineeEvent(meta) {
  logger.info('Trainee event', meta);
}

function formatTrainee(trainee, { includeNotes = false } = {}) {
  const data = {
    id: trainee.id,
    cohort: trainee.cohort,
    firstName: trainee.firstName,
    lastName: trainee.lastName,
    email: trainee.email,
    country: trainee.country,
    photo: trainee.photo,
    bio: trainee.bio,
    education: trainee.education,
    top3Skills: trainee.top3Skills,
    coreTechSkills: trainee.coreTechSkills,
    industriesOfInterest: trainee.industriesOfInterest,
    whyMEST: trainee.whyMEST,
    technicalBackground: trainee.technicalBackground,
    aiSkillLevel: trainee.aiSkillLevel,
    linkedIn: trainee.linkedIn,
    github: trainee.github,
    portfolio: trainee.portfolio,
    funFact: trainee.funFact,
    entryScore: trainee.entryScore,
    isActive: trainee.isActive,
    createdAt: trainee.createdAt,
    updatedAt: trainee.updatedAt,
  };

  if (includeNotes && trainee.notes !== undefined) {
    data.notes = trainee.notes;
  }

  return data;
}

async function create(req, res, next) {
  try {
    const { cohortId } = req.params;

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Cohort not found.' });
      return;
    }

    if (cohort.isArchived) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Cannot add trainees to an archived cohort.',
      });
      return;
    }

    const {
      firstName, lastName, email, country, photo, bio,
      technicalBackground, aiSkillLevel, linkedIn, github,
      portfolio, entryScore, notes,
    } = req.body;

    const trainee = await Trainee.create({
      cohort: cohortId,
      firstName,
      lastName,
      email,
      country,
      photo,
      bio,
      technicalBackground,
      aiSkillLevel,
      linkedIn,
      github,
      portfolio,
      entryScore,
      notes,
    });

    logTraineeEvent({
      event: 'trainee_created',
      traineeId: trainee.id,
      cohortId,
      email: trainee.email,
      createdBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    const result = await Trainee.findById(trainee.id).select('+notes');

    sendSuccess(res, 201, {
      data: formatTrainee(result, { includeNotes: true }),
      message: 'Trainee added successfully.',
    });
  } catch (err) {
    if (err?.code === 11000) {
      sendError(res, 409, {
        code: ERROR_CODES.DUPLICATE_ENTRY,
        message: 'A trainee with that email already exists.',
      });
      return;
    }
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { cohortId } = req.params;
    const page = req.query.page ?? 1;
    const limit = req.query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter = { cohort: cohortId };

    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
      ];
    }

    if (req.query.country) {
      filter.country = new RegExp(req.query.country, 'i');
    }

    const [trainees, total] = await Promise.all([
      Trainee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Trainee.countDocuments(filter),
    ]);

    sendSuccess(res, 200, {
      data: trainees.map((t) => formatTrainee(t)),
      meta: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id)
      .select('+notes')
      .populate('cohort', 'name year isArchived startDate endDate');

    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }

    sendSuccess(res, 200, { data: formatTrainee(trainee, { includeNotes: true }) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id);

    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }

    const fields = [
      'firstName', 'lastName', 'email', 'country', 'photo', 'bio',
      'technicalBackground', 'aiSkillLevel', 'linkedIn', 'github',
      'portfolio', 'entryScore', 'notes', 'isActive',
    ];

    const updates = {};
    for (const field of fields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const updated = await Trainee.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('+notes');

    logTraineeEvent({
      event: 'trainee_updated',
      traineeId: trainee.id,
      updatedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 200, {
      data: formatTrainee(updated, { includeNotes: true }),
      message: 'Trainee updated successfully.',
    });
  } catch (err) {
    if (err?.code === 11000) {
      sendError(res, 409, {
        code: ERROR_CODES.DUPLICATE_ENTRY,
        message: 'A trainee with that email already exists.',
      });
      return;
    }
    next(err);
  }
}

async function listMemberChanges(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id).select('_id');
    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }

    const changes = await MemberChange.find({ trainee: trainee._id })
      .populate('team', 'name event')
      .populate('destinationTeam', 'name')
      .sort({ createdAt: -1 });

    sendSuccess(res, 200, { data: changes });
  } catch (err) {
    next(err);
  }
}

async function getInsights(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id).select('_id');
    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }
    const insight = await TraineeInsight.findOne({ trainee: trainee._id });
    if (!insight) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'No AI insights generated yet.' });
      return;
    }
    sendSuccess(res, 200, { data: { content: insight.content, generatedAt: insight.generatedAt } });
  } catch (err) {
    next(err);
  }
}

async function generateInsights(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id).select('_id');
    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }

    logger.info('Generating trainee insight report via MEST Intelligence', { traineeId: trainee.id });

    const content = await generateTraineeInsightReport({ traineeId: trainee.id });

    await TraineeInsight.findOneAndUpdate(
      { trainee: trainee._id },
      { $set: { content, generatedBy: req.admin.id, generatedAt: new Date() } },
      { upsert: true }
    );

    sendSuccess(res, 200, {
      data: { content, generatedAt: new Date() },
      message: 'AI insights generated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

async function listMentorReviews(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id).select('_id');
    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }
    const reviews = await MentorReview.find({ trainee: trainee._id })
      .populate('mentor', 'firstName lastName email')
      .sort({ createdAt: -1 });
    sendSuccess(res, 200, { data: reviews });
  } catch (err) {
    next(err);
  }
}

async function createMentorReview(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id).select('_id');
    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }
    const { content, rating } = req.body;
    if (!content?.trim()) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Review content is required.' });
      return;
    }
    const review = await MentorReview.create({
      trainee: trainee._id,
      mentor: req.admin.id,
      content,
      rating: rating ?? undefined,
    });
    const populated = await review.populate('mentor', 'firstName lastName email');

    setImmediate(async () => {
      try {
        const t = await Trainee.findById(trainee._id).select('firstName lastName cohort');
        await createNotification({
          type: 'mentor_review_added',
          title: 'Mentor review added',
          body: `${req.admin.firstName} added a review for ${t?.firstName ?? ''} ${t?.lastName ?? ''}`.trim(),
          link: `/trainees/${trainee._id}`,
          cohort: t?.cohort ?? null,
        });
      } catch {}
    });

    sendSuccess(res, 201, { data: populated, message: 'Review submitted.' });
  } catch (err) {
    next(err);
  }
}

async function listFacilitatorLogs(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id).select('_id');
    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }
    const logs = await FacilitatorLog.find({ trainee: trainee._id })
      .populate('facilitator', 'firstName lastName email')
      .sort({ createdAt: -1 });
    sendSuccess(res, 200, { data: logs });
  } catch (err) {
    next(err);
  }
}

async function createFacilitatorLog(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id).select('_id');
    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }
    const { note } = req.body;
    if (!note?.trim()) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Note is required.' });
      return;
    }
    const log = await FacilitatorLog.create({
      trainee: trainee._id,
      facilitator: req.admin.id,
      note,
    });
    const populated = await log.populate('facilitator', 'firstName lastName email');
    sendSuccess(res, 201, { data: populated, message: 'Log entry added.' });
  } catch (err) {
    next(err);
  }
}

async function sendProfileLink(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id).select('firstName lastName email');
    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }
    if (!trainee.email) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Trainee has no email address.' });
      return;
    }

    await ProfileCompletionToken.updateMany(
      { trainee: trainee._id, isRevoked: false },
      { $set: { isRevoked: true } }
    );

    const rawToken = generateRawToken();
    const tokenHash = hashEvaluationToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await ProfileCompletionToken.create({
      trainee: trainee._id,
      tokenHash,
      expiresAt,
      createdBy: req.admin.id,
    });

    const completionUrl = `${env.FRONTEND_URL}/complete-profile/${rawToken}`;

    await sendProfileCompletionEmail({
      to: trainee.email,
      firstName: trainee.firstName,
      completionUrl,
      expiresAt,
    });

    sendSuccess(res, 200, { data: { sent: true, expiresAt }, message: 'Profile completion link sent.' });
  } catch (err) {
    next(err);
  }
}

async function revokeProfileLink(req, res, next) {
  try {
    const trainee = await Trainee.findById(req.params.id).select('_id');
    if (!trainee) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' });
      return;
    }
    await ProfileCompletionToken.updateMany(
      { trainee: trainee._id, isRevoked: false },
      { $set: { isRevoked: true } }
    );
    sendSuccess(res, 200, { message: 'Profile completion link revoked.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, listMemberChanges, getInsights, generateInsights, listMentorReviews, createMentorReview, listFacilitatorLogs, createFacilitatorLog, sendProfileLink, revokeProfileLink };
