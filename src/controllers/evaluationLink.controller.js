const EvaluationLink = require('../models/EvaluationLink.model');
const EvaluationSubmission = require('../models/EvaluationSubmission.model');
const EvaluationInsight = require('../models/EvaluationInsight.model');
const EvaluationFeedbackLetter = require('../models/EvaluationFeedbackLetter.model');
const Event = require('../models/Event.model');
const Team = require('../models/Team.model');
const KPI = require('../models/KPI.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { sendEvaluationLinkEmail, sendProfessionalFeedbackEmail } = require('../services/email.service');
const { generateEvaluationInsights, generateSubmissionSummary, generateTeamFeedbackLetters } = require('../services/gemini.service');
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

function formatSubmission(submission) {
  return {
    id: submission.id,
    submittedAt: submission.submittedAt,
    evaluatorName: submission.evaluatorName,
    evaluatorEmail: submission.evaluatorEmail ?? null,
    aiSummary: submission.aiSummary ?? null,
    teamScores: submission.teamScores.map((ts) => ({
      team: ts.team ? { id: ts.team._id, name: ts.team.name } : ts.team,
      overallComment: ts.overallComment,
      scores: ts.scores.map((s) => ({
        kpi: s.kpi && s.kpi.name
          ? { id: s.kpi._id, name: s.kpi.name, weight: s.kpi.weight, scaleType: s.kpi.scaleType }
          : s.kpi,
        score: s.score,
        comment: s.comment || null,
        recommendation: s.recommendation || null,
      })),
    })),
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

async function getLink(req, res, next) {
  try {
    const link = await EvaluationLink.findById(req.params.id).populate('teams', 'name');
    if (!link) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Evaluation link not found.' });
      return;
    }

    const submission = await EvaluationSubmission.findOne({ link: link._id })
      .populate('teamScores.team', 'name')
      .populate('teamScores.scores.kpi', 'name weight scaleType');

    sendSuccess(res, 200, {
      data: {
        ...formatLink(link),
        submission: submission ? formatSubmission(submission) : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function generateTeamLetters(req, res, next) {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select('_id name');
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

    // Direct ID → KPI map for reliable lookup
    const kpiById = Object.fromEntries(kpis.map((k) => [k.id, k]));

    function scaleMax(kpi) {
      if (kpi.scaleType === '1_to_5') return 5;
      if (kpi.scaleType === '1_to_10') return 10;
      if (kpi.scaleType === 'percentage') return 100;
      return kpi.scaleMax ?? 10;
    }

    // Build structured score data per team, keyed by KPI id
    const scoreData = {};
    for (const team of teams) {
      scoreData[team.id] = {
        kpis: Object.fromEntries(
          kpis.map((k) => [k.id, {
            name: k.name,
            scaleMax: scaleMax(k),
            scores: [],
            comments: [],
            recommendations: [],
          }])
        ),
        overallComments: [],
      };
    }

    for (const sub of submissions) {
      for (const ts of sub.teamScores) {
        const teamId = ts.team.toString();
        if (!scoreData[teamId]) continue;
        if (ts.overallComment) scoreData[teamId].overallComments.push(ts.overallComment);
        for (const s of ts.scores) {
          const kpiId = s.kpi.toString();
          const entry = scoreData[teamId].kpis[kpiId];
          if (!entry) continue;
          entry.scores.push(s.score);
          if (s.comment) entry.comments.push(s.comment);
          if (s.recommendation) entry.recommendations.push(s.recommendation);
        }
      }
    }

    // Compute averages
    for (const teamId of Object.keys(scoreData)) {
      for (const entry of Object.values(scoreData[teamId].kpis)) {
        entry.avg = entry.scores.length > 0
          ? Math.round((entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length) * 100) / 100
          : null;
      }
    }

    // Convert to array format for service
    const scoreDataForService = {};
    for (const [teamId, td] of Object.entries(scoreData)) {
      scoreDataForService[teamId] = {
        kpis: Object.values(td.kpis),
        overallComments: td.overallComments,
      };
    }

    const insight = await EvaluationInsight.findOne({ event: eventId });

    const letters = await generateTeamFeedbackLetters({
      event,
      teams,
      scoreData: scoreDataForService,
      insights: insight?.content ?? null,
    });

    sendSuccess(res, 200, { data: { letters } });
  } catch (err) {
    next(err);
  }
}

async function sendTeamFeedback(req, res, next) {
  try {
    const { eventId } = req.params;
    const { letters } = req.body; // [{ teamId, letter }]

    if (!Array.isArray(letters) || letters.length === 0) {
      sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'letters array is required.' });
      return;
    }

    const event = await Event.findById(eventId).select('_id name');
    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    const parentDoc = await Event.findById(eventId).select('parentEvent');
    const teamEventIds = [eventId];
    if (parentDoc?.parentEvent) teamEventIds.push(parentDoc.parentEvent.toString());

    const teams = await Team.find({ event: { $in: teamEventIds }, isDissolved: false })
      .populate({ path: 'members.trainee', select: 'firstName lastName email' });

    const letterMap = Object.fromEntries(letters.map((l) => [l.teamId, l.letter]));

    const sent = [];
    for (const team of teams) {
      const letter = letterMap[team.id];
      if (!letter) continue;

      const recipients = team.members.map((m) => m.trainee).filter((t) => t?.email);
      if (recipients.length === 0) continue;

      for (const member of recipients) {
        sendProfessionalFeedbackEmail({
          to: member.email,
          firstName: member.firstName,
          teamName: team.name,
          eventName: event.name,
          letter,
        }).catch((err) => logger.warn('Team feedback email failed', { to: member.email, err: err?.message }));
      }

      // Persist the letter so teams can view it on the portal
      EvaluationFeedbackLetter.findOneAndUpdate(
        { team: team._id, event: eventId },
        { team: team._id, event: eventId, letter, sentAt: new Date(), sentBy: req.admin.id },
        { upsert: true, new: true }
      ).catch((err) => logger.warn('Failed to persist feedback letter', { teamId: team.id, err: err?.message }));

      sent.push({ teamId: team.id, teamName: team.name, recipientCount: recipients.length });
    }

    logLinkEvent({
      event: 'team_feedback_sent',
      eventId,
      sentBy: req.admin.id,
      teamCount: sent.length,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 200, { data: { teams: sent }, message: `Feedback sent to ${sent.length} team(s).` });
  } catch (err) {
    next(err);
  }
}

async function summarizeSubmission(req, res, next) {
  try {
    const link = await EvaluationLink.findById(req.params.id);
    if (!link) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Evaluation link not found.' });
      return;
    }

    const submission = await EvaluationSubmission.findOne({ link: link._id })
      .populate('teamScores.team', 'name')
      .populate('teamScores.scores.kpi', 'name scaleType scaleMin scaleMax');

    if (!submission) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'No submission found for this link.' });
      return;
    }

    // Return cached summary if available
    if (submission.aiSummary) {
      sendSuccess(res, 200, { data: { summary: submission.aiSummary, cached: true } });
      return;
    }

    // Compute this expert's deviation from group average to determine scoring style
    const allSubmissions = await EvaluationSubmission.find({ event: link.event });
    const groupScores = {};
    for (const sub of allSubmissions) {
      for (const ts of sub.teamScores) {
        const teamId = ts.team.toString();
        if (!groupScores[teamId]) groupScores[teamId] = {};
        for (const s of ts.scores) {
          const kpiId = s.kpi.toString();
          if (!groupScores[teamId][kpiId]) groupScores[teamId][kpiId] = [];
          groupScores[teamId][kpiId].push(s.score);
        }
      }
    }

    let totalDiff = 0;
    let diffCount = 0;
    for (const ts of submission.teamScores) {
      const teamId = ts.team._id.toString();
      for (const s of ts.scores) {
        const kpiId = s.kpi._id.toString();
        const groupArr = groupScores[teamId]?.[kpiId] ?? [];
        if (groupArr.length > 1) {
          const groupAvg = groupArr.reduce((a, b) => a + b, 0) / groupArr.length;
          totalDiff += s.score - groupAvg;
          diffCount++;
        }
      }
    }
    const avgDiff = diffCount > 0 ? totalDiff / diffCount : 0;
    const scoringStyle = avgDiff < -0.5 ? 'strict' : avgDiff > 0.5 ? 'generous' : 'balanced';

    const summary = await generateSubmissionSummary({ submission, scoringStyle });

    submission.aiSummary = summary;
    await submission.save();

    sendSuccess(res, 200, { data: { summary, cached: false } });
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

module.exports = { create, list, getLink, results, generateTeamLetters, sendTeamFeedback, summarizeSubmission, resend, revoke, getInsights, generateInsights };
