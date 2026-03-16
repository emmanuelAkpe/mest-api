const Event = require('../models/Event.model');
const Cohort = require('../models/Cohort.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');
const { getIp, getUserAgent } = require('../utils/request');

function logEventEvent(meta) {
  logger.info('Event event', meta);
}

function computeStatus(event) {
  const now = new Date();
  if (now < event.startDate) return 'not_started';
  if (now > event.endDate) return 'completed';
  return 'in_progress';
}

function buildStatusFilter(status) {
  const now = new Date();
  switch (status) {
    case 'not_started': return { startDate: { $gt: now } };
    case 'in_progress':  return { startDate: { $lte: now }, endDate: { $gte: now } };
    case 'completed':   return { endDate: { $lt: now } };
    default:            return {};
  }
}

function formatParentEvent(parent) {
  if (!parent) return null;
  const id = (parent.id && typeof parent.id === 'string') ? parent.id
    : (parent._id ? parent._id.toString() : null);
  return { id, name: parent.name, type: parent.type };
}

function formatEvent(event) {
  return {
    id: event.id,
    cohort: event.cohort,
    parentEvent: formatParentEvent(event.parentEvent),
    name: event.name,
    type: event.type,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    status: computeStatus(event),
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
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
        message: 'Cannot add events to an archived cohort.',
      });
      return;
    }

    const { name, type, description, startDate, endDate, parentEvent } = req.body;

    if (new Date(endDate) <= new Date(startDate)) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'End date must be after start date.',
      });
      return;
    }

    if (parentEvent) {
      const parent = await Event.findById(parentEvent).select('_id');
      if (!parent) {
        sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Parent event not found.' });
        return;
      }
    }

    const event = await Event.create({
      cohort: cohortId,
      parentEvent: parentEvent ?? null,
      name,
      type,
      description,
      startDate,
      endDate,
      createdBy: req.admin.id,
    });

    logEventEvent({
      event: 'event_created',
      eventId: event.id,
      cohortId,
      name: event.name,
      type: event.type,
      createdBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 201, {
      data: formatEvent(event),
      message: 'Event created successfully.',
    });
  } catch (err) {
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
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) Object.assign(filter, buildStatusFilter(req.query.status));

    const [events, total] = await Promise.all([
      Event.find(filter).populate('parentEvent', 'id name type').sort({ startDate: 1 }).skip(skip).limit(limit),
      Event.countDocuments(filter),
    ]);

    sendSuccess(res, 200, {
      data: events.map(formatEvent),
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
    const event = await Event.findById(req.params.id)
      .populate('cohort', 'name year isArchived')
      .populate('parentEvent', 'id name type')
      .populate('createdBy', 'firstName lastName email');

    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    sendSuccess(res, 200, { data: formatEvent(event) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    if (computeStatus(event) === 'completed') {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Completed events cannot be edited.',
      });
      return;
    }

    const { name, type, description, startDate, endDate } = req.body;

    const resolvedStart = startDate !== undefined ? new Date(startDate) : event.startDate;
    const resolvedEnd = endDate !== undefined ? new Date(endDate) : event.endDate;

    if (resolvedEnd <= resolvedStart) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'End date must be after start date.',
      });
      return;
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description;
    if (startDate !== undefined) updates.startDate = resolvedStart;
    if (endDate !== undefined) updates.endDate = resolvedEnd;

    const updated = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    logEventEvent({
      event: 'event_updated',
      eventId: event.id,
      updatedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 200, {
      data: formatEvent(updated),
      message: 'Event updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update };
