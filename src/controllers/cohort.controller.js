const Cohort = require('../models/Cohort.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');
const { getIp, getUserAgent } = require('../utils/request');

function logCohortEvent(meta) {
  logger.info('Cohort event', meta);
}

function computeStatus(cohort) {
  if (cohort.isArchived) return 'archived';
  const now = new Date();
  if (now < cohort.startDate) return 'upcoming';
  if (now > cohort.endDate) return 'completed';
  return 'active';
}

function buildStatusFilter(status) {
  const now = new Date();
  switch (status) {
    case 'upcoming':  return { isArchived: false, startDate: { $gt: now } };
    case 'active':    return { isArchived: false, startDate: { $lte: now }, endDate: { $gte: now } };
    case 'completed': return { isArchived: false, endDate: { $lt: now } };
    case 'archived':  return { isArchived: true };
    default:          return {};
  }
}

function formatCohort(cohort) {
  return {
    id: cohort.id,
    name: cohort.name,
    year: cohort.year,
    description: cohort.description,
    status: computeStatus(cohort),
    startDate: cohort.startDate,
    endDate: cohort.endDate,
    createdBy: cohort.createdBy,
    createdAt: cohort.createdAt,
    updatedAt: cohort.updatedAt,
  };
}

async function create(req, res, next) {
  try {
    const { name, year, description, startDate, endDate } = req.body;

    if (new Date(endDate) <= new Date(startDate)) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'End date must be after start date.',
      });
      return;
    }

    const cohort = await Cohort.create({
      name,
      year,
      description,
      startDate,
      endDate,
      createdBy: req.admin.id,
    });

    logCohortEvent({
      event: 'cohort_created',
      cohortId: cohort.id,
      name: cohort.name,
      year: cohort.year,
      createdBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 201, {
      data: formatCohort(cohort),
      message: 'Cohort created successfully.',
    });
  } catch (err) {
    if (err?.code === 11000) {
      sendError(res, 409, {
        code: ERROR_CODES.DUPLICATE_ENTRY,
        message: 'A cohort with that name already exists for this year.',
      });
      return;
    }
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const page = req.query.page ?? 1;
    const limit = req.query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) Object.assign(filter, buildStatusFilter(req.query.status));
    if (req.query.year) filter.year = req.query.year;

    const [cohorts, total] = await Promise.all([
      Cohort.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email'),
      Cohort.countDocuments(filter),
    ]);

    sendSuccess(res, 200, {
      data: cohorts.map(formatCohort),
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
    const cohort = await Cohort.findById(req.params.id).populate(
      'createdBy',
      'firstName lastName email'
    );

    if (!cohort) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Cohort not found.' });
      return;
    }

    sendSuccess(res, 200, { data: formatCohort(cohort) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const cohort = await Cohort.findById(req.params.id);

    if (!cohort) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Cohort not found.' });
      return;
    }

    if (cohort.isArchived) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Archived cohorts cannot be edited.',
      });
      return;
    }

    const { name, year, description, startDate, endDate } = req.body;

    const resolvedStart = startDate !== undefined ? new Date(startDate) : cohort.startDate;
    const resolvedEnd = endDate !== undefined ? new Date(endDate) : cohort.endDate;

    if (resolvedEnd <= resolvedStart) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'End date must be after start date.',
      });
      return;
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (year !== undefined) updates.year = year;
    if (description !== undefined) updates.description = description;
    if (startDate !== undefined) updates.startDate = resolvedStart;
    if (endDate !== undefined) updates.endDate = resolvedEnd;

    const updated = await Cohort.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    logCohortEvent({
      event: 'cohort_updated',
      cohortId: cohort.id,
      updatedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 200, {
      data: formatCohort(updated),
      message: 'Cohort updated successfully.',
    });
  } catch (err) {
    if (err?.code === 11000) {
      sendError(res, 409, {
        code: ERROR_CODES.DUPLICATE_ENTRY,
        message: 'A cohort with that name already exists for this year.',
      });
      return;
    }
    next(err);
  }
}

async function archive(req, res, next) {
  try {
    const cohort = await Cohort.findById(req.params.id);

    if (!cohort) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Cohort not found.' });
      return;
    }

    if (cohort.isArchived) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Cohort is already archived.',
      });
      return;
    }

    cohort.isArchived = true;
    await cohort.save();

    logCohortEvent({
      event: 'cohort_archived',
      cohortId: cohort.id,
      archivedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 200, {
      data: formatCohort(cohort),
      message: 'Cohort archived successfully.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, archive };
