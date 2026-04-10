const EvaluationLink = require('../models/EvaluationLink.model');
const EvaluationSubmission = require('../models/EvaluationSubmission.model');
const Event = require('../models/Event.model');
const KPI = require('../models/KPI.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');
const { getIp, getUserAgent } = require('../utils/request');
const { hashEvaluationToken } = require('../utils/tokenUtils');
const { createNotification } = require('../services/notification.service');

function logEvaluateEvent(meta) {
  logger.info('Evaluate event', meta);
}

async function findValidLink(token, res) {
  const tokenHash = hashEvaluationToken(token);
  const link = await EvaluationLink.findOne({ tokenHash })
    .select('+tokenHash')
    .populate({
      path: 'teams',
      select: 'name members productIdea marketFocus',
      populate: { path: 'members.trainee', select: 'firstName lastName photo' },
    });

  if (!link) {
    sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Evaluation link not found.' });
    return null;
  }
  if (link.isRevoked) {
    sendError(res, 403, { code: ERROR_CODES.FORBIDDEN, message: 'This link has been revoked.' });
    return null;
  }
  if (link.expiresAt < new Date()) {
    sendError(res, 403, { code: ERROR_CODES.FORBIDDEN, message: 'This link has expired.' });
    return null;
  }
  return link;
}

async function getForm(req, res, next) {
  try {
    const { token } = req.params;
    const link = await findValidLink(token, res);
    if (!link) return;

    // Mark as opened on first visit
    if (link.status === 'not_opened') {
      link.status = 'opened';
      await link.save();
    }

    const event = await Event.findById(link.event).select('name type startDate endDate');
    const kpis = await KPI.find({ event: link.event }).sort({ order: 1, createdAt: 1 });

    const existingSubmission = await EvaluationSubmission.findOne({ link: link._id });

    sendSuccess(res, 200, {
      data: {
        evaluatorName: link.evaluatorName,
        canUpdate: true,
        event: {
          id: event.id,
          name: event.name,
          type: event.type,
          startDate: event.startDate,
          endDate: event.endDate,
        },
        teams: link.teams,
        kpis: kpis.map((k) => ({
          id: k.id,
          name: k.name,
          description: k.description ?? null,
          weight: k.weight,
          scaleType: k.scaleType,
          scaleMin: k.scaleMin ?? null,
          scaleMax: k.scaleMax ?? null,
          appliesTo: k.appliesTo,
          requireComment: k.requireComment,
          showRecommendation: k.showRecommendation,
          order: k.order,
        })),
        existingSubmission: existingSubmission
          ? { teamScores: existingSubmission.teamScores, submittedAt: existingSubmission.submittedAt }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

function getScoreRange(kpi) {
  switch (kpi.scaleType) {
    case '1_to_5': return { min: 1, max: 5 };
    case '1_to_10': return { min: 1, max: 10 };
    case 'percentage': return { min: 0, max: 100 };
    case 'custom': return { min: kpi.scaleMin, max: kpi.scaleMax };
    default: return { min: null, max: null };
  }
}

async function submit(req, res, next) {
  try {
    const { token } = req.params;
    const link = await findValidLink(token, res);
    if (!link) return;

    const { teamScores } = req.body;
    const kpis = await KPI.find({ event: link.event }).sort({ order: 1, createdAt: 1 });

    // Validate: submitted teams must belong to this link (partial submission is allowed)
    const linkTeamIds = link.teams.map((t) => t._id.toString());
    const submittedTeamIds = teamScores.map((ts) => ts.team.toString());

    if (submittedTeamIds.length === 0) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'No team scores provided.' });
      return;
    }

    const extraTeams = submittedTeamIds.filter((id) => !linkTeamIds.includes(id));
    if (extraTeams.length > 0) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: `Submitted team(s) not assigned to this link: ${extraTeams.join(', ')}.`,
      });
      return;
    }

    const kpiMap = {};
    for (const kpi of kpis) {
      kpiMap[kpi.id] = kpi;
    }
    const kpiIds = kpis.map((k) => k.id);

    // Validate each team's scores
    for (const ts of teamScores) {
      const submittedKpiIds = ts.scores.map((s) => s.kpi.toString());

      const missingKpis = kpiIds.filter((id) => !submittedKpiIds.includes(id));
      if (missingKpis.length > 0) {
        sendError(res, 400, {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Team ${ts.team}: missing scores for KPI(s): ${missingKpis.join(', ')}.`,
        });
        return;
      }

      for (const s of ts.scores) {
        const kpi = kpiMap[s.kpi.toString()];
        if (!kpi) {
          sendError(res, 400, {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `KPI ${s.kpi} does not belong to this event.`,
          });
          return;
        }

        const { min, max } = getScoreRange(kpi);
        if (min !== null && (s.score < min || s.score > max)) {
          sendError(res, 400, {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Score for KPI "${kpi.name}" must be between ${min} and ${max}. Got ${s.score}.`,
          });
          return;
        }

        if (kpi.requireComment && !s.comment?.trim()) {
          sendError(res, 400, {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `A comment is required for KPI "${kpi.name}".`,
          });
          return;
        }
      }
    }

    const now = new Date();

    // Merge new scores with any previously submitted teams
    const existing = await EvaluationSubmission.findOne({ link: link._id });
    const mergedMap = {};
    if (existing) {
      for (const ts of existing.teamScores) {
        mergedMap[ts.team.toString()] = ts;
      }
    }
    for (const ts of teamScores) {
      mergedMap[ts.team.toString()] = ts;
    }
    const mergedTeamScores = Object.values(mergedMap);

    const submission = await EvaluationSubmission.findOneAndUpdate(
      { link: link._id },
      {
        $set: {
          link: link._id,
          event: link.event,
          evaluatorName: link.evaluatorName,
          evaluatorEmail: link.evaluatorEmail,
          teamScores: mergedTeamScores,
          submittedAt: now,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Update link status to submitted
    if (link.status !== 'submitted') {
      link.status = 'submitted';
      await link.save();
    }

    logEvaluateEvent({
      event: 'evaluation_submitted',
      linkId: link.id,
      eventId: link.event,
      evaluatorName: link.evaluatorName,
      teamCount: teamScores.length,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    setImmediate(async () => {
      try {
        const event = await Event.findById(link.event).select('name cohort');
        await createNotification({
          type: 'evaluation_submitted',
          title: 'Evaluation submitted',
          body: `${link.evaluatorName} submitted scores for ${teamScores.length} team${teamScores.length !== 1 ? 's' : ''} in "${event?.name ?? 'an event'}"`,
          link: `/events/${link.event}`,
          cohort: event?.cohort ?? null,
        });
      } catch {}
    });

    sendSuccess(res, 200, {
      data: {
        submissionId: submission.id,
        submittedAt: submission.submittedAt,
        evaluatorName: submission.evaluatorName,
        submittedTeamIds: mergedTeamScores.map((ts) => ts.team.toString()),
        teamCount: mergedTeamScores.length,
      },
      message: 'Evaluation submitted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getForm, submit };
