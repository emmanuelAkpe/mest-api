const EvaluationLink = require('../models/EvaluationLink.model');
const EvaluationSubmission = require('../models/EvaluationSubmission.model');
const EvaluationInsight = require('../models/EvaluationInsight.model');
const Event = require('../models/Event.model');
const Team = require('../models/Team.model');
const KPI = require('../models/KPI.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { sendEvaluationLinkEmail } = require('../services/email.service');
const { generateEvaluationInsights } = require('../services/gemini.service');
const { logger } = require('../utils/logger');
const { getIp, getUserAgent } = require('../utils/request');
const { generateRawToken, hashEvaluationToken } = require('../utils/tokenUtils');

function logLinkEvent(meta) {
  logger.info('EvaluationLink event', meta);
}

function formatLink(link) {
  return {
    id: link.id,
    event: link.event,
    evaluatorName: link.evaluatorName,
    evaluatorEmail: link.evaluatorEmail ?? null,
    teams: link.teams,
    status: link.status,
    expiresAt: link.expiresAt,
    isRevoked: link.isRevoked,
    evalUrl: link.evalUrl ?? null,
    createdBy: link.createdBy,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

async function create(req, res, next) {
  try {
    const { eventId } = req.params;
    const { evaluatorName, evaluatorEmail, teams, expiresAt } = req.body;

    const event = await Event.findById(eventId).select('_id');
    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    if (new Date(expiresAt) <= new Date()) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'expiresAt must be in the future.' });
      return;
    }

    // Verify all teams belong to this event or its parent (sessions inherit parent teams)
    const eventDoc = await Event.findById(eventId).select('parentEvent');
    const validEventIds = [eventId];
    if (eventDoc?.parentEvent) validEventIds.push(eventDoc.parentEvent.toString());

    const teamDocs = await Team.find({ _id: { $in: teams }, event: { $in: validEventIds } }).select('_id');
    if (teamDocs.length !== teams.length) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'One or more team IDs are invalid or do not belong to this event.',
      });
      return;
    }

    const rawToken = generateRawToken();
    const tokenHash = hashEvaluationToken(rawToken);
    const evalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/evaluate/${rawToken}`;

    const link = await EvaluationLink.create({
      event: eventId,
      evaluatorName,
      evaluatorEmail,
      teams,
      tokenHash,
      evalUrl,
      expiresAt,
      createdBy: req.admin.id,
    });

    logLinkEvent({
      event: 'evaluation_link_created',
      linkId: link.id,
      eventId,
      evaluatorName,
      createdBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    // Send email if evaluator has an address — fire-and-forget, never block the response
    if (evaluatorEmail) {
      const eventDoc = await Event.findById(eventId).select('name');
      sendEvaluationLinkEmail({
        to: evaluatorEmail,
        evaluatorName,
        eventName: eventDoc?.name ?? 'MEST Event',
        evalUrl,
        expiresAt,
      }).catch((err) => logger.warn('Evaluation email failed', { evaluatorEmail, err: err?.message }));
    }

    sendSuccess(res, 201, {
      data: { ...formatLink(link), token: rawToken, emailSent: !!evaluatorEmail },
      message: 'Evaluation link created. Save the token — it will not be shown again.',
    });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select('_id');
    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    const links = await EvaluationLink.find({ event: eventId })
      .populate('teams', 'name')
      .sort({ createdAt: -1 });

    sendSuccess(res, 200, {
      data: links.map(formatLink),
      meta: { total: links.length },
    });
  } catch (err) {
    next(err);
  }
}

async function results(req, res, next) {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select('_id name type');
    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    const kpis = await KPI.find({ event: eventId }).sort({ order: 1, createdAt: 1 });
    const parentDoc = await Event.findById(eventId).select('parentEvent');
    const teamEventIds = [eventId];
    if (parentDoc?.parentEvent) teamEventIds.push(parentDoc.parentEvent.toString());
    const teams = await Team.find({ event: { $in: teamEventIds }, isDissolved: false }).select('name');
    const submissions = await EvaluationSubmission.find({ event: eventId });

    const totalLinks = await EvaluationLink.countDocuments({ event: eventId, isRevoked: false });
    const submittedCount = submissions.length;

    // Build a lookup: teamId → kpiId → [scores]
    const scoreMap = {};
    for (const team of teams) {
      scoreMap[team.id] = {};
      for (const kpi of kpis) {
        scoreMap[team.id][kpi.id] = [];
      }
    }

    for (const sub of submissions) {
      for (const ts of sub.teamScores) {
        const teamId = ts.team.toString();
        if (!scoreMap[teamId]) continue;
        for (const s of ts.scores) {
          const kpiId = s.kpi.toString();
          if (!scoreMap[teamId][kpiId]) scoreMap[teamId][kpiId] = [];
          scoreMap[teamId][kpiId].push({
            evaluatorName: sub.evaluatorName,
            score: s.score,
            comment: s.comment || null,
            recommendation: s.recommendation || null,
          });
        }
      }
    }

    // Compute divergence threshold per scale type
    function scaleRange(kpi) {
      switch (kpi.scaleType) {
        case '1_to_5': return 5;
        case '1_to_10': return 10;
        case 'percentage': return 100;
        case 'custom': return (kpi.scaleMax ?? 10) - (kpi.scaleMin ?? 0);
        default: return 10;
      }
    }

    function stdDev(arr) {
      if (arr.length < 2) return 0;
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
      const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
      return Math.sqrt(variance);
    }

    const teamResults = teams.map((team) => {
      const kpiBreakdown = kpis.map((kpi) => {
        const entries = scoreMap[team.id]?.[kpi.id] ?? [];
        const scoreValues = entries.map((e) => e.score);
        const avg = scoreValues.length > 0
          ? Math.round((scoreValues.reduce((s, v) => s + v, 0) / scoreValues.length) * 100) / 100
          : null;
        const threshold = scaleRange(kpi) * 0.2; // 20% of scale = divergence flag
        const divergent = stdDev(scoreValues) > threshold;

        return {
          kpiId: kpi.id,
          kpiName: kpi.name,
          weight: kpi.weight,
          scaleType: kpi.scaleType,
          avgScore: avg,
          scoreCount: scoreValues.length,
          divergent: scoreValues.length >= 2 ? divergent : false,
          entries,
        };
      });

      const scoredKpis = kpiBreakdown.filter((k) => k.avgScore !== null);
      const overallAvg = scoredKpis.length > 0
        ? Math.round(
            (scoredKpis.reduce((s, k) => s + k.avgScore, 0) / scoredKpis.length) * 100
          ) / 100
        : null;

      return {
        teamId: team.id,
        teamName: team.name,
        overallAvg,
        kpis: kpiBreakdown,
      };
    });

    sendSuccess(res, 200, {
      data: {
        event: { id: event.id, name: event.name, type: event.type },
        evaluatorCount: submittedCount,
        meta: { linksIssued: totalLinks, submitted: submittedCount },
        teamResults,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function resend(req, res, next) {
  try {
    const link = await EvaluationLink.findById(req.params.id);
    if (!link) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Evaluation link not found.' });
      return;
    }

    if (link.isRevoked) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Cannot resend a revoked link.' });
      return;
    }

    if (!link.evaluatorEmail) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'This link has no email address on record.' });
      return;
    }

    if (!link.evalUrl) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Link URL not stored — this link was created before resend was supported.' });
      return;
    }

    const eventDoc = await Event.findById(link.event).select('name');
    await sendEvaluationLinkEmail({
      to: link.evaluatorEmail,
      evaluatorName: link.evaluatorName,
      eventName: eventDoc?.name ?? 'MEST Event',
      evalUrl: link.evalUrl,
      expiresAt: link.expiresAt,
    });

    logLinkEvent({
      event: 'evaluation_link_resent',
      linkId: link.id,
      eventId: link.event,
      resentBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 200, { message: `Evaluation link resent to ${link.evaluatorEmail}.` });
  } catch (err) {
    next(err);
  }
}

async function revoke(req, res, next) {
  try {
    const link = await EvaluationLink.findById(req.params.id);
    if (!link) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Evaluation link not found.' });
      return;
    }

    if (link.isRevoked) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Link is already revoked.' });
      return;
    }

    link.isRevoked = true;
    await link.save();

    logLinkEvent({
      event: 'evaluation_link_revoked',
      linkId: link.id,
      eventId: link.event,
      revokedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 200, {
      data: formatLink(link),
      message: 'Evaluation link revoked.',
    });
  } catch (err) {
    next(err);
  }
}

async function getInsights(req, res, next) {
  try {
    const { eventId } = req.params;
    const insight = await EvaluationInsight.findOne({ event: eventId });
    if (!insight) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'No AI insights generated yet for this event.' });
      return;
    }
    sendSuccess(res, 200, { data: { content: insight.content, generatedAt: insight.generatedAt } });
  } catch (err) {
    next(err);
  }
}

async function generateInsights(req, res, next) {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select('_id name type');
    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    const kpis = await KPI.find({ event: eventId }).sort({ order: 1, createdAt: 1 });
    const parentDoc = await Event.findById(eventId).select('parentEvent');
    const teamEventIds = [eventId];
    if (parentDoc?.parentEvent) teamEventIds.push(parentDoc.parentEvent.toString());

    const teams = await Team.find({ event: { $in: teamEventIds }, isDissolved: false })
      .select('name productIdea marketFocus');
    const submissions = await EvaluationSubmission.find({ event: eventId });

    if (submissions.length === 0) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'No evaluations submitted yet.' });
      return;
    }

    logger.info('Generating Gemini evaluation insights', { eventId, teams: teams.length, submissions: submissions.length });

    const content = await generateEvaluationInsights({ event, kpis, teams, submissions });

    // Upsert — replace if regenerated
    await EvaluationInsight.findOneAndUpdate(
      { event: eventId },
      { $set: { content, generatedBy: req.admin.id, generatedAt: new Date() } },
      { upsert: true }
    );

    logger.info('Gemini evaluation insights saved', { eventId });

    sendSuccess(res, 200, {
      data: { content, generatedAt: new Date() },
      message: 'AI insights generated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, results, resend, revoke, getInsights, generateInsights };
