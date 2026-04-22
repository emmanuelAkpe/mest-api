const Cohort = require('../models/Cohort.model');
const Event = require('../models/Event.model');
const Team = require('../models/Team.model');
const Trainee = require('../models/Trainee.model');
const KPI = require('../models/KPI.model');
const EvaluationSubmission = require('../models/EvaluationSubmission.model');
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

function scaleRange(kpi) {
  switch (kpi.scaleType) {
    case '1_to_5': return { min: 1, max: 5, range: 4 };
    case '1_to_10': return { min: 1, max: 10, range: 9 };
    case 'percentage': return { min: 0, max: 100, range: 100 };
    case 'custom': return {
      min: kpi.scaleMin ?? 0,
      max: kpi.scaleMax ?? 10,
      range: (kpi.scaleMax ?? 10) - (kpi.scaleMin ?? 0),
    };
    default: return { min: 1, max: 10, range: 9 };
  }
}

function normalizeScore(rawScore, kpi) {
  const sr = scaleRange(kpi);
  if (sr.range === 0) return 0;
  return Math.round(((rawScore - sr.min) / sr.range) * 100);
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

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

async function getDashboardStats(req, res, next) {
  try {
    const cohortId = req.params.id;
    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Cohort not found.' });
      return;
    }

    const events = await Event.find({ cohort: cohortId }).lean();
    const eventIds = events.map((e) => e._id.toString());
    const now = new Date();

    const activeEventIds = events
      .filter((e) => new Date(e.startDate) <= now && new Date(e.endDate) >= now)
      .map((e) => e._id.toString());

    const [activeTeamCount, totalTeamCount, traineeCount, kpis, submissions] = await Promise.all([
      activeEventIds.length > 0
        ? Team.countDocuments({ event: { $in: activeEventIds }, isDissolved: false })
        : Promise.resolve(0),
      Team.countDocuments({ cohort: cohortId, isDissolved: false }),
      Trainee.countDocuments({ cohort: cohortId }),
      KPI.find({ event: { $in: eventIds } }).lean(),
      EvaluationSubmission.find({ event: { $in: eventIds } }).lean(),
    ]);

    // Avg normalized KPI score across all submissions
    const allNormalized = [];
    for (const sub of submissions) {
      for (const ts of sub.teamScores) {
        for (const s of ts.scores) {
          const kpi = kpis.find((k) => k._id.toString() === s.kpi?.toString());
          if (!kpi) continue;
          allNormalized.push(normalizeScore(s.score, kpi));
        }
      }
    }
    const avgNormalizedScore = allNormalized.length > 0
      ? Math.round(allNormalized.reduce((a, b) => a + b, 0) / allNormalized.length)
      : null;

    // Top teams: from most recent event that has submission data
    const eventsWithSubs = [...new Set(submissions.map((s) => s.event?.toString()).filter(Boolean))];
    let topTeams = [];

    if (eventsWithSubs.length > 0) {
      const latestEvent = events
        .filter((e) => eventsWithSubs.includes(e._id.toString()))
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];

      if (latestEvent) {
        const latestId = latestEvent._id.toString();
        const eventKpis = kpis.filter((k) => k.event?.toString() === latestId);
        const eventTeamIds = [latestId];
        if (latestEvent.parentEvent) eventTeamIds.push(latestEvent.parentEvent.toString());
        const eventTeams = await Team.find({ event: { $in: eventTeamIds } })
          .select('name productIdea isDissolved members')
          .lean();
        const eventSubs = submissions.filter((s) => s.event?.toString() === latestId);

        const scoreMap = {};
        for (const team of eventTeams) scoreMap[team._id.toString()] = [];
        for (const sub of eventSubs) {
          for (const ts of sub.teamScores) {
            const tid = ts.team?.toString();
            if (!scoreMap[tid]) continue;
            for (const s of ts.scores) {
              const kpi = eventKpis.find((k) => k._id.toString() === s.kpi?.toString());
              if (!kpi) continue;
              scoreMap[tid].push(normalizeScore(s.score, kpi));
            }
          }
        }

        // Compute role completeness for health index
        const KEY_ROLES = ['team_lead', 'cto', 'product', 'business', 'marketing'];

        topTeams = eventTeams
          .map((team) => {
            const scores = scoreMap[team._id.toString()] || [];
            if (scores.length === 0) return null;
            const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            const teamRoles = (team.members || []).flatMap((m) => m.roles || []);
            const roleFill = KEY_ROLES.filter((r) => teamRoles.includes(r)).length;
            const roleScore = Math.round((roleFill / KEY_ROLES.length) * 100);
            const stabilityScore = team.isDissolved ? 0 : 100;
            const healthScore = Math.round((avgScore * 0.5) + (roleScore * 0.3) + (stabilityScore * 0.2));
            return {
              id: team._id.toString(),
              name: team.name,
              productIdea: team.productIdea,
              avgNormalizedScore: avgScore,
              healthScore,
              memberCount: (team.members || []).length,
              eventName: latestEvent.name,
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.avgNormalizedScore - a.avgNormalizedScore)
          .slice(0, 3);
      }
    }

    // Recent activity: last 6 evaluation submissions
    const recentSubs = await EvaluationSubmission.find({ event: { $in: eventIds } })
      .populate('event', 'name')
      .sort({ submittedAt: -1, createdAt: -1 })
      .limit(6)
      .lean();

    const recentActivity = recentSubs.map((sub) => ({
      type: 'evaluation',
      text: `${sub.evaluatorName} evaluated ${sub.event?.name ?? 'an event'}`,
      teamCount: (sub.teamScores || []).length,
      timestamp: sub.submittedAt || sub.createdAt,
    }));

    sendSuccess(res, 200, {
      data: {
        activeTeamCount,
        totalTeamCount,
        traineeCount,
        avgNormalizedScore,
        topTeams,
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

async function getAnalytics(req, res, next) {
  try {
    const cohortId = req.params.id;
    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Cohort not found.' });
      return;
    }

    // Top-level events only (not sessions)
    const events = await Event.find({ cohort: cohortId, parentEvent: null })
      .sort({ startDate: 1 })
      .lean();
    const eventIds = events.map((e) => e._id.toString());

    const [kpis, submissions, allTeams, traineeCount] = await Promise.all([
      KPI.find({ event: { $in: eventIds } }).lean(),
      EvaluationSubmission.find({ event: { $in: eventIds } }).lean(),
      Team.find({ cohort: cohortId })
        .populate('members.trainee', 'firstName lastName')
        .select('name productIdea marketFocus event isDissolved status members')
        .lean(),
      Trainee.countDocuments({ cohort: cohortId }),
    ]);

    // ── Event Performance ──
    const now = new Date();
    const eventPerformance = await Promise.all(events.map(async (event) => {
      const eid = event._id.toString();
      const eventKpis = kpis.filter((k) => k.event?.toString() === eid);
      const eventSubs = submissions.filter((s) => s.event?.toString() === eid);
      const eventTeams = allTeams.filter((t) => t.event?.toString() === eid);

      const teamScoreMap = {};
      for (const team of eventTeams) teamScoreMap[team._id.toString()] = { name: team.name, scores: [] };

      for (const sub of eventSubs) {
        for (const ts of sub.teamScores) {
          const tid = ts.team?.toString();
          if (!teamScoreMap[tid]) continue;
          for (const s of ts.scores) {
            const kpi = eventKpis.find((k) => k._id.toString() === s.kpi?.toString());
            if (!kpi) continue;
            teamScoreMap[tid].scores.push(normalizeScore(s.score, kpi));
          }
        }
      }

      const teamScores = Object.entries(teamScoreMap)
        .map(([tid, data]) => ({
          teamId: tid,
          teamName: data.name,
          avgNormalizedScore: data.scores.length > 0
            ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
            : null,
          evaluated: data.scores.length > 0,
        }))
        .sort((a, b) => (b.avgNormalizedScore ?? -1) - (a.avgNormalizedScore ?? -1));

      const scoredTeams = teamScores.filter((t) => t.avgNormalizedScore !== null);
      const avgNormalizedScore = scoredTeams.length > 0
        ? Math.round(scoredTeams.reduce((s, t) => s + t.avgNormalizedScore, 0) / scoredTeams.length)
        : null;

      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      const eventStatus = now < startDate ? 'upcoming' : now > endDate ? 'completed' : 'active';

      return {
        eventId: eid,
        eventName: event.name,
        eventType: event.type,
        status: eventStatus,
        date: event.startDate,
        endDate: event.endDate,
        submissionCount: eventSubs.length,
        teamCount: eventTeams.length,
        avgNormalizedScore,
        teamScores,
      };
    }));

    // ── KPI Summary ──
    const kpiMap = {};
    for (const kpi of kpis) {
      const kid = kpi._id.toString();
      if (!kpiMap[kid]) kpiMap[kid] = { name: kpi.name, scores: [] };
    }

    for (const sub of submissions) {
      for (const ts of sub.teamScores) {
        for (const s of ts.scores) {
          const kpi = kpis.find((k) => k._id.toString() === s.kpi?.toString());
          if (!kpi) continue;
          kpiMap[kpi._id.toString()].scores.push(normalizeScore(s.score, kpi));
        }
      }
    }

    const kpiSummary = Object.entries(kpiMap)
      .map(([kpiId, data]) => {
        if (data.scores.length === 0) return null;
        return {
          kpiId,
          kpiName: data.name,
          avgNormalizedScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
          dataPoints: data.scores.length,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.avgNormalizedScore - a.avgNormalizedScore);

    // ── Team Trajectories ──
    const teamEventScores = {};
    for (const perf of eventPerformance) {
      for (const ts of perf.teamScores) {
        if (ts.avgNormalizedScore === null) continue;
        if (!teamEventScores[ts.teamName]) teamEventScores[ts.teamName] = [];
        teamEventScores[ts.teamName].push({ eventName: perf.eventName, date: perf.date, score: ts.avgNormalizedScore });
      }
    }

    const teamTrajectories = Object.entries(teamEventScores)
      .map(([teamName, points]) => ({ teamName, points: points.sort((a, b) => new Date(a.date) - new Date(b.date)) }));

    // ── Teams Roster ──
    const teamEvalMap = {};
    for (const perf of eventPerformance) {
      for (const ts of perf.teamScores) {
        if (!teamEvalMap[ts.teamId]) teamEvalMap[ts.teamId] = { scores: [], evalCount: 0 };
        if (ts.avgNormalizedScore !== null) {
          teamEvalMap[ts.teamId].scores.push(ts.avgNormalizedScore);
          teamEvalMap[ts.teamId].evalCount += 1;
        }
      }
    }

    const ROLE_LABELS = {
      team_lead: 'Team Lead', cto: 'CTO', product: 'Product',
      business: 'Business', marketing: 'Marketing', presenter: 'Presenter',
    };

    const teamsRoster = allTeams
      .filter((t) => !t.isDissolved)
      .map((t) => {
        const tid = t._id.toString();
        const evalData = teamEvalMap[tid] ?? { scores: [], evalCount: 0 };
        const avgScore = evalData.scores.length > 0
          ? Math.round(evalData.scores.reduce((a, b) => a + b, 0) / evalData.scores.length)
          : null;
        return {
          id: tid,
          name: t.name,
          productIdea: t.productIdea || null,
          marketFocus: t.marketFocus || null,
          memberCount: t.members.length,
          members: t.members.map((m) => ({
            name: m.trainee ? `${m.trainee.firstName} ${m.trainee.lastName}` : 'Unknown',
            roles: (m.roles || []).map((r) => ROLE_LABELS[r] ?? r),
          })),
          avgScore,
          evalCount: evalData.evalCount,
        };
      });

    // ── Overview ──
    const overview = {
      totalTeams: allTeams.filter((t) => !t.isDissolved).length,
      dissolvedTeams: allTeams.filter((t) => t.isDissolved).length,
      totalTrainees: traineeCount,
      totalEvents: events.length,
      eventsEvaluated: eventPerformance.filter((e) => e.submissionCount > 0).length,
      avgCohortScore: kpiSummary.length > 0
        ? Math.round(kpiSummary.reduce((s, k) => s + k.avgNormalizedScore, 0) / kpiSummary.length)
        : null,
    };

    sendSuccess(res, 200, {
      data: { overview, eventPerformance, teamsRoster, kpiSummary, teamTrajectories },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, archive, getDashboardStats, getAnalytics };
