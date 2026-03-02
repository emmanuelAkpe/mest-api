const KPI = require('../models/KPI.model');
const Event = require('../models/Event.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');
const { getIp, getUserAgent } = require('../utils/request');

function logKPIEvent(meta) {
  logger.info('KPI event', meta);
}

function formatKPI(kpi) {
  return {
    id: kpi.id,
    event: kpi.event,
    name: kpi.name,
    description: kpi.description,
    weight: kpi.weight,
    scaleType: kpi.scaleType,
    scaleMin: kpi.scaleMin ?? null,
    scaleMax: kpi.scaleMax ?? null,
    appliesTo: kpi.appliesTo,
    requireComment: kpi.requireComment,
    showRecommendation: kpi.showRecommendation,
    order: kpi.order,
    createdBy: kpi.createdBy,
    createdAt: kpi.createdAt,
    updatedAt: kpi.updatedAt,
  };
}

function withNormalizedWeights(kpis) {
  const total = kpis.reduce((sum, k) => sum + k.weight, 0);
  return {
    kpis: kpis.map((k) => ({
      ...formatKPI(k),
      weightNormalized: total > 0 ? Math.round((k.weight / total) * 10000) / 100 : 0,
    })),
    totalWeight: total,
  };
}

function validateCustomScale(scaleType, scaleMin, scaleMax) {
  if (scaleType === 'custom') {
    if (scaleMin === undefined || scaleMin === null) {
      return 'scaleMin is required when scaleType is custom.';
    }
    if (scaleMax === undefined || scaleMax === null) {
      return 'scaleMax is required when scaleType is custom.';
    }
    if (scaleMax <= scaleMin) {
      return 'scaleMax must be greater than scaleMin.';
    }
  }
  return null;
}

async function list(req, res, next) {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select('_id');
    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    const kpis = await KPI.find({ event: eventId }).sort({ order: 1, createdAt: 1 });
    const { kpis: normalized, totalWeight } = withNormalizedWeights(kpis);

    sendSuccess(res, 200, {
      data: normalized,
      meta: { total: kpis.length, totalWeight },
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select('_id');
    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    const {
      name, description, weight, scaleType,
      scaleMin, scaleMax, appliesTo,
      requireComment, showRecommendation, order,
    } = req.body;

    const scaleError = validateCustomScale(scaleType, scaleMin, scaleMax);
    if (scaleError) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: scaleError });
      return;
    }

    const count = await KPI.countDocuments({ event: eventId });

    const kpi = await KPI.create({
      event: eventId,
      name,
      description,
      weight,
      scaleType,
      scaleMin: scaleType === 'custom' ? scaleMin : undefined,
      scaleMax: scaleType === 'custom' ? scaleMax : undefined,
      appliesTo,
      requireComment,
      showRecommendation,
      order: order !== undefined ? order : count + 1,
      createdBy: req.admin.id,
    });

    logKPIEvent({
      event: 'kpi_created',
      kpiId: kpi.id,
      eventId,
      name: kpi.name,
      createdBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    const allKpis = await KPI.find({ event: eventId }).sort({ order: 1, createdAt: 1 });
    const { kpis: normalized, totalWeight } = withNormalizedWeights(allKpis);

    sendSuccess(res, 201, {
      data: normalized,
      meta: { total: allKpis.length, totalWeight },
      message: 'KPI created successfully.',
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const kpi = await KPI.findById(req.params.id);
    if (!kpi) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'KPI not found.' });
      return;
    }

    const {
      name, description, weight, scaleType,
      scaleMin, scaleMax, appliesTo,
      requireComment, showRecommendation, order,
    } = req.body;

    const resolvedScaleType = scaleType !== undefined ? scaleType : kpi.scaleType;
    const resolvedMin = scaleMin !== undefined ? scaleMin : kpi.scaleMin;
    const resolvedMax = scaleMax !== undefined ? scaleMax : kpi.scaleMax;

    const scaleError = validateCustomScale(resolvedScaleType, resolvedMin, resolvedMax);
    if (scaleError) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: scaleError });
      return;
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (weight !== undefined) updates.weight = weight;
    if (scaleType !== undefined) {
      updates.scaleType = scaleType;
      updates.scaleMin = scaleType === 'custom' ? resolvedMin : undefined;
      updates.scaleMax = scaleType === 'custom' ? resolvedMax : undefined;
    } else {
      if (scaleMin !== undefined && kpi.scaleType === 'custom') updates.scaleMin = scaleMin;
      if (scaleMax !== undefined && kpi.scaleType === 'custom') updates.scaleMax = scaleMax;
    }
    if (appliesTo !== undefined) updates.appliesTo = appliesTo;
    if (requireComment !== undefined) updates.requireComment = requireComment;
    if (showRecommendation !== undefined) updates.showRecommendation = showRecommendation;
    if (order !== undefined) updates.order = order;

    await KPI.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });

    logKPIEvent({
      event: 'kpi_updated',
      kpiId: kpi.id,
      eventId: kpi.event,
      updatedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    const allKpis = await KPI.find({ event: kpi.event }).sort({ order: 1, createdAt: 1 });
    const { kpis: normalized, totalWeight } = withNormalizedWeights(allKpis);

    sendSuccess(res, 200, {
      data: normalized,
      meta: { total: allKpis.length, totalWeight },
      message: 'KPI updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const kpi = await KPI.findById(req.params.id);
    if (!kpi) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'KPI not found.' });
      return;
    }

    const eventId = kpi.event;
    await kpi.deleteOne();

    logKPIEvent({
      event: 'kpi_deleted',
      kpiId: kpi.id,
      eventId,
      deletedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    const allKpis = await KPI.find({ event: eventId }).sort({ order: 1, createdAt: 1 });
    const { kpis: normalized, totalWeight } = withNormalizedWeights(allKpis);

    sendSuccess(res, 200, {
      data: normalized,
      meta: { total: allKpis.length, totalWeight },
      message: 'KPI deleted.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
