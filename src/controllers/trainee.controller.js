const Trainee = require('../models/Trainee.model');
const Cohort = require('../models/Cohort.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');
const { getIp, getUserAgent } = require('../utils/request');

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
    technicalBackground: trainee.technicalBackground,
    aiSkillLevel: trainee.aiSkillLevel,
    linkedIn: trainee.linkedIn,
    github: trainee.github,
    portfolio: trainee.portfolio,
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

module.exports = { create, list, getById, update };
