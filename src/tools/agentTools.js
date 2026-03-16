const Cohort = require('../models/Cohort.model');
const Trainee = require('../models/Trainee.model');
const Team = require('../models/Team.model');
const Event = require('../models/Event.model');
const KPI = require('../models/KPI.model');
const EvaluationSubmission = require('../models/EvaluationSubmission.model');
const EvaluationLink = require('../models/EvaluationLink.model');

// Truncate a string to maxLen characters
function trunc(str, maxLen = 250) {
  if (!str) return str;
  const s = String(str);
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

// Compute scale range for a KPI
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

function avg(arr) {
  if (!arr || arr.length === 0) return null;
  return Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100;
}

function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// ─── Tool Declarations ───────────────────────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: 'listCohorts',
    description: 'List all cohorts in the MEST platform with their names, years, and status.',
  },
  {
    name: 'getCohortStats',
    description: 'Get aggregate statistics for a specific cohort: trainee count, team count, event count, active events, dissolved teams.',
    parameters: {
      type: 'object',
      properties: {
        cohortId: { type: 'string', description: 'The MongoDB ObjectId of the cohort.' },
      },
      required: ['cohortId'],
    },
  },
  {
    name: 'searchTeams',
    description: 'Search and filter teams by cohort, event, or name/product idea keyword.',
    parameters: {
      type: 'object',
      properties: {
        cohortId: { type: 'string', description: 'Filter teams by cohort ID.' },
        eventId: { type: 'string', description: 'Filter teams by event ID.' },
        query: { type: 'string', description: 'Search text in team name or product idea.' },
      },
    },
  },
  {
    name: 'getTeamDeepProfile',
    description: 'Get full profile of a team including members, roles, and evaluation summary with judge comments.',
    parameters: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'The MongoDB ObjectId of the team.' },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'listTrainees',
    description: 'List trainees, optionally filtered by cohort or team.',
    parameters: {
      type: 'object',
      properties: {
        cohortId: { type: 'string', description: 'Filter by cohort ID.' },
        teamId: { type: 'string', description: 'Filter by team ID (returns only members of that team).' },
      },
    },
  },
  {
    name: 'getTraineeProfile',
    description: 'Get full profile of a trainee including their teams and roles.',
    parameters: {
      type: 'object',
      properties: {
        traineeId: { type: 'string', description: 'The MongoDB ObjectId of the trainee.' },
      },
      required: ['traineeId'],
    },
  },
  {
    name: 'listEvents',
    description: 'List events, optionally filtered by cohort and/or status.',
    parameters: {
      type: 'object',
      properties: {
        cohortId: { type: 'string', description: 'Filter by cohort ID.' },
        status: {
          type: 'string',
          description: 'Filter by status: not_started, in_progress, or completed.',
        },
      },
    },
  },
  {
    name: 'getEventEvaluationResults',
    description: 'Get full evaluation results for an event: scores per KPI per team, judge comments, and overall comments.',
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'The MongoDB ObjectId of the event.' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'getTeamRankings',
    description: 'Get ranked list of teams for an event by overall evaluation score.',
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'The MongoDB ObjectId of the event.' },
        limit: { type: 'number', description: 'Number of teams to return (default 10).' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'identifyAtRiskSignals',
    description: 'Identify at-risk teams (low scores, divergent evaluations), incomplete evaluations, and dissolved teams.',
    parameters: {
      type: 'object',
      properties: {
        cohortId: { type: 'string', description: 'Filter signals by cohort ID.' },
        eventId: { type: 'string', description: 'Filter signals to a specific event.' },
      },
    },
  },
  {
    name: 'getTeamProgressOverTime',
    description: 'Track a team\'s score trajectory across all events — shows momentum (improving/stable/declining), normalized scores per event, and per-KPI trends. Use this to answer questions about team growth, velocity, or consistency.',
    parameters: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'The MongoDB ObjectId of the team.' },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'getCohortBenchmarks',
    description: 'Compare all cohorts against each other using normalized 0-100 scores. Shows avg performance, percentile rank, per-KPI breakdown, team/trainee counts per cohort. Use this for cross-cohort comparisons or to benchmark a specific cohort. Returns kpiBreakdown showing which KPIs are strong/weak for each cohort.',
    parameters: {
      type: 'object',
      properties: {
        cohortId: { type: 'string', description: 'Optional: highlight a specific cohort in the results.' },
      },
    },
  },
  {
    name: 'getJudgeCalibration',
    description: 'Analyze judge scoring patterns for an event: identify lenient vs. strict judges, inter-rater reliability per KPI, and which criteria have the most disagreement. Essential for evaluation quality and fairness analysis.',
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'The MongoDB ObjectId of the event.' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'getMemberCrossTeamHistory',
    description: 'Analyze member movement patterns across teams in a cohort: leadership signals, multi-team members, frequent co-workers, dissolution experience. Use this for deep team dynamics and member network analysis.',
    parameters: {
      type: 'object',
      properties: {
        cohortId: { type: 'string', description: 'The MongoDB ObjectId of the cohort.' },
      },
      required: ['cohortId'],
    },
  },
];

// ─── Tool Implementations ─────────────────────────────────────────────────────

async function listCohorts() {
  try {
    const cohorts = await Cohort.find().sort({ year: -1, createdAt: -1 }).lean();
    return cohorts.map((c, i) => ({
      id: c._id.toString(),
      name: trunc(c.name),
      year: c.year,
      status: c.isArchived ? 'archived' : 'active',
      cohortNumber: cohorts.length - i,
    }));
  } catch (err) {
    return { error: err.message };
  }
}

async function getCohortStats({ cohortId }) {
  try {
    const cohort = await Cohort.findById(cohortId).lean();
    if (!cohort) return { error: 'Cohort not found.' };

    const [traineeCount, teamCount, events, dissolutedTeams] = await Promise.all([
      Trainee.countDocuments({ cohort: cohortId }),
      Team.countDocuments({ cohort: cohortId }),
      Event.find({ cohort: cohortId }).select('startDate endDate').lean(),
      Team.countDocuments({ cohort: cohortId, isDissolved: true }),
    ]);

    const now = new Date();
    const activeEvents = events.filter(
      (e) => new Date(e.startDate) <= now && new Date(e.endDate) >= now
    ).length;

    return {
      cohort: {
        id: cohort._id.toString(),
        name: trunc(cohort.name),
        year: cohort.year,
        status: cohort.isArchived ? 'archived' : 'active',
      },
      traineeCount,
      teamCount,
      eventCount: events.length,
      activeEvents,
      dissolutedTeams,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function searchTeams({ cohortId, eventId, query } = {}) {
  try {
    const filter = {};
    if (cohortId) filter.cohort = cohortId;
    if (eventId) filter.event = eventId;
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { productIdea: { $regex: query, $options: 'i' } },
      ];
    }

    const teams = await Team.find(filter)
      .populate('event', 'name')
      .select('name productIdea marketFocus members isDissolved event')
      .lean();

    return teams.map((t) => ({
      id: t._id.toString(),
      name: trunc(t.name),
      productIdea: trunc(t.productIdea),
      marketFocus: trunc(t.marketFocus),
      memberCount: (t.members || []).length,
      isDissolved: t.isDissolved,
      event: t.event ? trunc(t.event.name) : null,
    }));
  } catch (err) {
    return { error: err.message };
  }
}

async function getTeamDeepProfile({ teamId }) {
  try {
    const team = await Team.findById(teamId)
      .populate('members.trainee', 'firstName lastName')
      .populate('event', 'name')
      .lean();

    if (!team) return { error: 'Team not found.' };

    const members = (team.members || []).map((m) => ({
      name: m.trainee
        ? trunc(`${m.trainee.firstName} ${m.trainee.lastName}`)
        : 'Unknown',
      roles: m.roles || [],
    }));

    // Find all events this team has participated in — the team's event and events
    // whose teams include this team (via EvaluationSubmission)
    const eventIds = [team.event?._id ?? team.event].filter(Boolean);

    // Get all submissions that have scores for this team
    const submissions = await EvaluationSubmission.find({
      event: { $in: eventIds },
    })
      .populate('event', 'name')
      .lean();

    const teamIdStr = teamId.toString();
    const relevantSubs = submissions.filter((sub) =>
      (sub.teamScores || []).some((ts) => ts.team?.toString() === teamIdStr)
    );

    let evaluationSummary = null;
    if (relevantSubs.length > 0) {
      // Gather KPI ids from scores
      const allKpiIds = new Set();
      for (const sub of relevantSubs) {
        for (const ts of sub.teamScores) {
          if (ts.team?.toString() !== teamIdStr) continue;
          for (const s of ts.scores) {
            allKpiIds.add(s.kpi?.toString());
          }
        }
      }

      const kpis = await KPI.find({ _id: { $in: [...allKpiIds] } }).lean();
      const kpiMap = {};
      kpis.forEach((k) => { kpiMap[k._id.toString()] = k; });

      // kpiId → scores + comments
      const kpiData = {};
      const judgeSentiments = [];

      for (const sub of relevantSubs) {
        for (const ts of sub.teamScores) {
          if (ts.team?.toString() !== teamIdStr) continue;
          if (ts.overallComment) {
            judgeSentiments.push(trunc(ts.overallComment, 150));
          }
          for (const s of ts.scores) {
            const kid = s.kpi?.toString();
            if (!kpiData[kid]) kpiData[kid] = { scores: [], comments: [] };
            kpiData[kid].scores.push(s.score);
            if (s.comment) kpiData[kid].comments.push(trunc(s.comment, 150));
          }
        }
      }

      const kpiBreakdown = Object.entries(kpiData).map(([kid, data]) => {
        const kpi = kpiMap[kid];
        return {
          kpiName: kpi ? trunc(kpi.name) : kid,
          avg: avg(data.scores),
          judgeCount: data.scores.length,
          topComments: data.comments.slice(0, 3),
        };
      });

      // Compute overall avg across all scored KPIs
      const allScores = kpiBreakdown.filter((k) => k.avg !== null).map((k) => k.avg);
      const latestEventName = relevantSubs[relevantSubs.length - 1]?.event?.name;

      evaluationSummary = {
        eventCount: new Set(relevantSubs.map((s) => s.event?._id?.toString())).size,
        latestEvent: trunc(latestEventName),
        latestOverallAvg: avg(allScores),
        kpiBreakdown,
        judgeSentiment: judgeSentiments.slice(0, 5),
      };
    }

    return {
      id: team._id.toString(),
      name: trunc(team.name),
      productIdea: trunc(team.productIdea),
      marketFocus: trunc(team.marketFocus),
      isDissolved: team.isDissolved,
      members,
      evaluationSummary,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function listTrainees({ cohortId, teamId } = {}) {
  try {
    const filter = {};
    if (cohortId) filter.cohort = cohortId;

    let traineeFilter = filter;

    // If teamId provided, get trainee IDs from that team first
    if (teamId) {
      const team = await Team.findById(teamId).select('members').lean();
      if (!team) return { error: 'Team not found.' };
      const memberIds = (team.members || []).map((m) => m.trainee?.toString()).filter(Boolean);
      traineeFilter = { ...filter, _id: { $in: memberIds } };
    }

    const trainees = await Trainee.find(traineeFilter)
      .select('firstName lastName cohort country bio technicalBackground aiSkillLevel')
      .lean();

    // Get team memberships for each trainee
    const traineeIds = trainees.map((t) => t._id.toString());
    const teams = await Team.find({ 'members.trainee': { $in: traineeIds } })
      .select('name members')
      .lean();

    // Build lookup: traineeId → [{ teamName, roles }]
    const membershipMap = {};
    for (const team of teams) {
      for (const m of (team.members || [])) {
        const tid = m.trainee?.toString();
        if (!tid) continue;
        if (!membershipMap[tid]) membershipMap[tid] = [];
        membershipMap[tid].push({ teamName: trunc(team.name), roles: m.roles || [] });
      }
    }

    return trainees.map((t) => {
      const memberships = membershipMap[t._id.toString()] || [];
      const primary = memberships[0];
      return {
        id: t._id.toString(),
        name: trunc(`${t.firstName} ${t.lastName}`),
        track: trunc(t.technicalBackground),
        countryOfOrigin: trunc(t.country),
        teamName: primary ? primary.teamName : null,
        roles: primary ? primary.roles : [],
      };
    });
  } catch (err) {
    return { error: err.message };
  }
}

async function getTraineeProfile({ traineeId }) {
  try {
    const trainee = await Trainee.findById(traineeId).lean();
    if (!trainee) return { error: 'Trainee not found.' };

    // Find all teams this trainee is a member of
    const teams = await Team.find({ 'members.trainee': traineeId })
      .populate('event', 'name')
      .lean();

    const teamsFormatted = teams.map((team) => {
      const memberEntry = (team.members || []).find(
        (m) => m.trainee?.toString() === traineeId.toString()
      );
      return {
        teamName: trunc(team.name),
        eventName: team.event ? trunc(team.event.name) : null,
        roles: memberEntry ? memberEntry.roles : [],
        productIdea: trunc(team.productIdea),
      };
    });

    return {
      id: trainee._id.toString(),
      name: trunc(`${trainee.firstName} ${trainee.lastName}`),
      email: trainee.email,
      track: trainee.technicalBackground,
      bio: trunc(trainee.bio),
      countryOfOrigin: trunc(trainee.country),
      teams: teamsFormatted,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function listEvents({ cohortId, status } = {}) {
  try {
    const filter = {};
    if (cohortId) filter.cohort = cohortId;

    const events = await Event.find(filter)
      .sort({ startDate: -1 })
      .lean();

    const now = new Date();

    const results = await Promise.all(
      events.map(async (e) => {
        // Compute status
        let computedStatus = 'not_started';
        if (new Date(e.startDate) <= now && new Date(e.endDate) >= now) {
          computedStatus = 'in_progress';
        } else if (new Date(e.endDate) < now) {
          computedStatus = 'completed';
        }

        if (status && computedStatus !== status) return null;

        const [sessionCount, teamCount] = await Promise.all([
          Event.countDocuments({ parentEvent: e._id }),
          Team.countDocuments({ event: e._id }),
        ]);

        return {
          id: e._id.toString(),
          name: trunc(e.name),
          type: e.type,
          status: computedStatus,
          startDate: e.startDate,
          endDate: e.endDate,
          sessionCount,
          teamCount,
        };
      })
    );

    return results.filter(Boolean);
  } catch (err) {
    return { error: err.message };
  }
}

async function getEventEvaluationResults({ eventId }) {
  try {
    const event = await Event.findById(eventId).select('_id name type parentEvent').lean();
    if (!event) return { error: 'Event not found.' };

    const kpis = await KPI.find({ event: eventId }).sort({ order: 1, createdAt: 1 }).lean();

    const teamEventIds = [eventId];
    if (event.parentEvent) teamEventIds.push(event.parentEvent.toString());
    const teams = await Team.find({ event: { $in: teamEventIds } }).select('name').lean();

    const submissions = await EvaluationSubmission.find({ event: eventId }).lean();

    // Build scoreMap: teamId → kpiId → [{ score, comment, evaluatorName }]
    const scoreMap = {};
    const overallCommentMap = {}; // teamId → [overallComment]
    for (const team of teams) {
      scoreMap[team._id.toString()] = {};
      overallCommentMap[team._id.toString()] = [];
      for (const kpi of kpis) {
        scoreMap[team._id.toString()][kpi._id.toString()] = [];
      }
    }

    for (const sub of submissions) {
      for (const ts of sub.teamScores) {
        const teamId = ts.team?.toString();
        if (!scoreMap[teamId]) continue;

        if (ts.overallComment) {
          overallCommentMap[teamId].push(trunc(ts.overallComment, 200));
        }

        for (const s of ts.scores) {
          const kpiId = s.kpi?.toString();
          if (!scoreMap[teamId][kpiId]) scoreMap[teamId][kpiId] = [];
          scoreMap[teamId][kpiId].push({
            evaluatorName: trunc(sub.evaluatorName),
            score: s.score,
            comment: s.comment ? trunc(s.comment, 200) : null,
          });
        }
      }
    }

    const teamResults = teams.map((team) => {
      const tid = team._id.toString();
      const kpisResult = kpis.map((kpi) => {
        const entries = scoreMap[tid]?.[kpi._id.toString()] ?? [];
        const scores = entries.map((e) => e.score);
        const kpiAvg = avg(scores);
        const judgeComments = entries
          .filter((e) => e.comment)
          .map((e) => e.comment)
          .slice(0, 5);

        return {
          name: trunc(kpi.name),
          avg: kpiAvg,
          weight: kpi.weight,
          judgeComments,
        };
      });

      const scoredKpis = kpisResult.filter((k) => k.avg !== null);
      const overallAvg = scoredKpis.length > 0
        ? avg(scoredKpis.map((k) => k.avg))
        : null;

      return {
        teamName: trunc(team.name),
        teamId: tid,
        overallAvg,
        kpis: kpisResult,
        overallComments: (overallCommentMap[tid] || []).slice(0, 5),
      };
    });

    return {
      event: {
        id: event._id.toString(),
        name: trunc(event.name),
        type: event.type,
      },
      evaluatorCount: submissions.length,
      teamResults,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function getTeamRankings({ eventId, limit = 10 }) {
  try {
    const event = await Event.findById(eventId).select('_id name parentEvent').lean();
    if (!event) return { error: 'Event not found.' };

    const kpis = await KPI.find({ event: eventId }).sort({ order: 1 }).lean();
    const teamEventIds = [eventId];
    if (event.parentEvent) teamEventIds.push(event.parentEvent.toString());
    const teams = await Team.find({ event: { $in: teamEventIds } }).select('name').lean();
    const submissions = await EvaluationSubmission.find({ event: eventId }).lean();

    // Build scoreMap: teamId → kpiId → scores[]
    const scoreMap = {};
    for (const team of teams) {
      scoreMap[team._id.toString()] = {};
      for (const kpi of kpis) {
        scoreMap[team._id.toString()][kpi._id.toString()] = [];
      }
    }

    for (const sub of submissions) {
      for (const ts of sub.teamScores) {
        const teamId = ts.team?.toString();
        if (!scoreMap[teamId]) continue;
        for (const s of ts.scores) {
          const kpiId = s.kpi?.toString();
          if (!scoreMap[teamId]?.[kpiId]) continue;
          scoreMap[teamId][kpiId].push(s.score);
        }
      }
    }

    const rankings = teams.map((team) => {
      const tid = team._id.toString();
      const kpiAvgs = kpis.map((kpi) => {
        const scores = scoreMap[tid]?.[kpi._id.toString()] ?? [];
        const rawAvg = avg(scores);
        if (rawAvg === null) return null;
        return { name: kpi.name, avg: rawAvg, normalizedScore: normalizeScore(rawAvg, kpi) };
      }).filter(Boolean);

      const overallAvg = kpiAvgs.length > 0 ? avg(kpiAvgs.map((k) => k.avg)) : null;
      const overallNormalized = kpiAvgs.length > 0 ? Math.round(avg(kpiAvgs.map((k) => k.normalizedScore))) : null;
      const sorted = [...kpiAvgs].sort((a, b) => (b.normalizedScore ?? 0) - (a.normalizedScore ?? 0));
      const strongestKpi = sorted[0]?.name ?? null;
      const weakestKpi = sorted[sorted.length - 1]?.name ?? null;

      // Divergent KPIs: stddev > 20% of scale range
      const divergentKpis = kpis
        .map((kpi) => {
          const scores = scoreMap[tid]?.[kpi._id.toString()] ?? [];
          if (scores.length < 2) return null;
          const sr = scaleRange(kpi);
          const sd = stdDev(scores);
          return sd > sr.range * 0.2 ? trunc(kpi.name) : null;
        })
        .filter(Boolean);

      return {
        teamName: trunc(team.name),
        teamId: tid,
        overallAvg,
        overallNormalizedScore: overallNormalized,
        strongestKpi: trunc(strongestKpi),
        weakestKpi: trunc(weakestKpi),
        divergentKpis,
      };
    });

    // Sort by overallAvg descending, nulls last
    rankings.sort((a, b) => {
      if (a.overallAvg === null) return 1;
      if (b.overallAvg === null) return -1;
      return b.overallAvg - a.overallAvg;
    });

    return rankings.slice(0, limit).map((r, i) => ({ rank: i + 1, ...r }));
  } catch (err) {
    return { error: err.message };
  }
}

async function identifyAtRiskSignals({ cohortId, eventId } = {}) {
  try {
    // Gather relevant events
    const eventFilter = {};
    if (cohortId) eventFilter.cohort = cohortId;
    if (eventId) eventFilter._id = eventId;
    const events = await Event.find(eventFilter).select('_id name cohort').lean();
    const eventIds = events.map((e) => e._id.toString());

    if (eventIds.length === 0) {
      return {
        lowScoringTeams: [],
        divergentEvaluations: [],
        incompleteEvaluations: [],
        dissolutedTeams: [],
      };
    }

    const kpis = await KPI.find({ event: { $in: eventIds } }).lean();
    const kpiMap = {};
    kpis.forEach((k) => { kpiMap[k._id.toString()] = k; });

    const teamFilter = cohortId ? { cohort: cohortId } : { event: { $in: eventIds } };
    const teams = await Team.find(teamFilter).select('name cohort event isDissolved').lean();
    const teamMap = {};
    teams.forEach((t) => { teamMap[t._id.toString()] = t; });

    const submissions = await EvaluationSubmission.find({ event: { $in: eventIds } }).lean();
    const eventMap = {};
    events.forEach((e) => { eventMap[e._id.toString()] = e; });

    // Build teamId → eventId → kpiId → scores[]
    const scoreMatrix = {};
    for (const sub of submissions) {
      const eid = sub.event?.toString();
      for (const ts of sub.teamScores) {
        const tid = ts.team?.toString();
        if (!scoreMatrix[tid]) scoreMatrix[tid] = {};
        if (!scoreMatrix[tid][eid]) scoreMatrix[tid][eid] = {};
        for (const s of ts.scores) {
          const kid = s.kpi?.toString();
          if (!scoreMatrix[tid][eid][kid]) scoreMatrix[tid][eid][kid] = [];
          scoreMatrix[tid][eid][kid].push(s.score);
        }
      }
    }

    // Compute per-team overallAvg per event
    const teamEventAvgs = []; // { teamId, teamName, eventId, eventName, overallAvg }
    for (const team of teams) {
      const tid = team._id.toString();
      for (const eid of eventIds) {
        if (!scoreMatrix[tid]?.[eid]) continue;
        const eventKpis = kpis.filter((k) => k.event?.toString() === eid);
        const kpiAvgs = eventKpis.map((kpi) => {
          const scores = scoreMatrix[tid][eid][kpi._id.toString()] ?? [];
          return avg(scores);
        }).filter((v) => v !== null);
        if (kpiAvgs.length === 0) continue;
        const overallAvg = avg(kpiAvgs);
        teamEventAvgs.push({
          teamId: tid,
          teamName: trunc(team.name),
          eventId: eid,
          eventName: trunc(eventMap[eid]?.name),
          overallAvg,
        });
      }
    }

    // Compute cohort average per event
    const eventAvgMap = {};
    for (const eid of eventIds) {
      const avgs = teamEventAvgs.filter((t) => t.eventId === eid).map((t) => t.overallAvg);
      eventAvgMap[eid] = avg(avgs);
    }

    // Determine scale range for each event (use first KPI as proxy)
    const eventScaleMap = {};
    for (const eid of eventIds) {
      const eventKpis = kpis.filter((k) => k.event?.toString() === eid);
      if (eventKpis.length === 0) {
        eventScaleMap[eid] = { min: 1, max: 10, range: 9 };
      } else {
        const sr = scaleRange(eventKpis[0]);
        eventScaleMap[eid] = sr;
      }
    }

    // Low scoring teams: overall avg < 60% of scale max
    const lowScoringTeams = [];
    for (const entry of teamEventAvgs) {
      const sr = eventScaleMap[entry.eventId];
      const threshold = sr.min + (sr.range * 0.6);
      const cohortAvg = eventAvgMap[entry.eventId];
      if (entry.overallAvg < threshold) {
        const pctBelow = cohortAvg
          ? Math.round(((cohortAvg - entry.overallAvg) / cohortAvg) * 100)
          : null;
        lowScoringTeams.push({
          teamName: entry.teamName,
          eventName: entry.eventName,
          overallAvg: entry.overallAvg,
          issue: pctBelow !== null
            ? `Below cohort average by ${pctBelow}%`
            : `Score ${entry.overallAvg.toFixed(2)} below 60% of scale`,
        });
      }
    }

    // Divergent evaluations: stddev > 20% of scale range for any KPI
    const divergentEvaluations = [];
    for (const team of teams) {
      const tid = team._id.toString();
      for (const eid of eventIds) {
        if (!scoreMatrix[tid]?.[eid]) continue;
        const eventKpis = kpis.filter((k) => k.event?.toString() === eid);
        for (const kpi of eventKpis) {
          const scores = scoreMatrix[tid][eid][kpi._id.toString()] ?? [];
          if (scores.length < 2) continue;
          const sr = scaleRange(kpi);
          const sd = stdDev(scores);
          if (sd > sr.range * 0.2) {
            divergentEvaluations.push({
              teamName: trunc(team.name),
              kpiName: trunc(kpi.name),
              reason: `Judges disagree: scores ranged from ${Math.min(...scores)} to ${Math.max(...scores)}`,
            });
          }
        }
      }
    }

    // Incomplete evaluations
    const incompleteEvaluations = [];
    for (const eid of eventIds) {
      const linksIssued = await EvaluationLink.countDocuments({ event: eid, isRevoked: false });
      const submitted = submissions.filter((s) => s.event?.toString() === eid).length;
      const pending = linksIssued - submitted;
      if (pending > 0) {
        incompleteEvaluations.push({
          eventName: trunc(eventMap[eid]?.name),
          linksIssued,
          submitted,
          pending,
        });
      }
    }

    // Dissolved teams
    const teamFilterForDissolved = cohortId
      ? { cohort: cohortId, isDissolved: true }
      : { event: { $in: eventIds }, isDissolved: true };
    const dissolutedTeamsDocs = await Team.find(teamFilterForDissolved)
      .populate('cohort', 'name')
      .select('name cohort')
      .lean();

    const dissolutedTeams = dissolutedTeamsDocs.map((t) => ({
      teamName: trunc(t.name),
      cohortName: t.cohort ? trunc(t.cohort.name) : 'Unknown',
    }));

    return {
      lowScoringTeams,
      divergentEvaluations,
      incompleteEvaluations,
      dissolutedTeams,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── New Tools ────────────────────────────────────────────────────────────────

function normalizeScore(rawScore, kpi) {
  const sr = scaleRange(kpi);
  return Math.round(((rawScore - sr.min) / sr.range) * 100);
}

async function getTeamProgressOverTime({ teamId }) {
  try {
    const team = await Team.findById(teamId)
      .populate('cohort', 'name')
      .populate('event', 'cohort')
      .lean();
    if (!team) return { error: 'Team not found.' };

    const cohortId = team.cohort?._id ?? team.cohort ?? team.event?.cohort;
    if (!cohortId) return { error: 'Cannot determine cohort for this team.' };

    const events = await Event.find({ cohort: cohortId }).sort({ startDate: 1 }).lean();
    const eventIds = events.map((e) => e._id.toString());

    const kpis = await KPI.find({ event: { $in: eventIds } }).lean();
    const submissions = await EvaluationSubmission.find({ event: { $in: eventIds } }).lean();

    const teamIdStr = teamId.toString();
    const trajectory = [];

    for (const event of events) {
      const eid = event._id.toString();
      const eventKpis = kpis.filter((k) => k.event?.toString() === eid);
      const eventSubs = submissions.filter((s) => s.event?.toString() === eid);

      const kpiScores = {};
      let hasData = false;

      for (const sub of eventSubs) {
        for (const ts of sub.teamScores) {
          if (ts.team?.toString() !== teamIdStr) continue;
          hasData = true;
          for (const s of ts.scores) {
            const kid = s.kpi?.toString();
            if (!kpiScores[kid]) kpiScores[kid] = [];
            kpiScores[kid].push(s.score);
          }
        }
      }

      if (!hasData) continue;

      const kpiBreakdown = eventKpis.map((kpi) => {
        const scores = kpiScores[kpi._id.toString()] || [];
        if (scores.length === 0) return null;
        const rawAvg = avg(scores);
        return {
          name: trunc(kpi.name),
          rawAvg,
          normalizedScore: normalizeScore(rawAvg, kpi),
          judgeCount: scores.length,
        };
      }).filter(Boolean);

      const normalizedScores = kpiBreakdown.map((k) => k.normalizedScore);
      const overallNormalized = normalizedScores.length > 0 ? avg(normalizedScores) : null;

      trajectory.push({
        eventId: eid,
        eventName: trunc(event.name),
        eventType: event.type,
        date: event.startDate,
        overallNormalizedScore: overallNormalized !== null ? Math.round(overallNormalized) : null,
        kpiBreakdown,
      });
    }

    let momentum = null;
    const scored = trajectory.filter((t) => t.overallNormalizedScore !== null);
    if (scored.length >= 2) {
      const last = scored[scored.length - 1];
      const prev = scored[scored.length - 2];
      const delta = last.overallNormalizedScore - prev.overallNormalizedScore;
      momentum = {
        direction: delta > 5 ? 'improving' : delta < -5 ? 'declining' : 'stable',
        delta: Math.round(delta),
        from: trunc(prev.eventName),
        to: trunc(last.eventName),
      };
    }

    return {
      team: { id: teamIdStr, name: trunc(team.name), productIdea: trunc(team.productIdea) },
      trajectory,
      momentum,
      eventsScored: scored.length,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function getCohortBenchmarks({ cohortId } = {}) {
  try {
    const cohorts = await Cohort.find().sort({ year: -1 }).lean();

    const benchmarks = await Promise.all(cohorts.map(async (cohort) => {
      const cid = cohort._id.toString();
      const events = await Event.find({ cohort: cid }).lean();
      const eventIds = events.map((e) => e._id.toString());

      if (eventIds.length === 0) {
        return {
          cohortId: cid,
          cohortName: trunc(cohort.name),
          year: cohort.year,
          status: cohort.isArchived ? 'archived' : 'active',
          teamCount: 0,
          traineeCount: 0,
          avgNormalizedScore: null,
          eventCount: 0,
          evaluationCount: 0,
          isTarget: cohortId ? cid === cohortId : false,
        };
      }

      const [kpis, submissions, teamCount, traineeCount] = await Promise.all([
        KPI.find({ event: { $in: eventIds } }).lean(),
        EvaluationSubmission.find({ event: { $in: eventIds } }).lean(),
        Team.countDocuments({ cohort: cid }),
        Trainee.countDocuments({ cohort: cid }),
      ]);

      const allNormalized = [];
      const kpiScoreMap = {};
      for (const sub of submissions) {
        for (const ts of sub.teamScores) {
          for (const s of ts.scores) {
            const kpi = kpis.find((k) => k._id.toString() === s.kpi?.toString());
            if (!kpi) continue;
            const norm = normalizeScore(s.score, kpi);
            allNormalized.push(norm);
            const kpiName = trunc(kpi.name, 60);
            if (!kpiScoreMap[kpiName]) kpiScoreMap[kpiName] = [];
            kpiScoreMap[kpiName].push(norm);
          }
        }
      }

      const kpiBreakdown = Object.entries(kpiScoreMap)
        .map(([name, scores]) => ({ name, avgNormalizedScore: Math.round(avg(scores)) }))
        .sort((a, b) => a.avgNormalizedScore - b.avgNormalizedScore);

      return {
        cohortId: cid,
        cohortName: trunc(cohort.name),
        year: cohort.year,
        status: cohort.isArchived ? 'archived' : 'active',
        teamCount,
        traineeCount,
        avgNormalizedScore: allNormalized.length > 0 ? Math.round(avg(allNormalized)) : null,
        eventCount: events.length,
        evaluationCount: submissions.length,
        isTarget: cohortId ? cid === cohortId : false,
        kpiBreakdown,
      };
    }));

    // Add percentile rank
    const scored = [...benchmarks]
      .filter((b) => b.avgNormalizedScore !== null)
      .sort((a, b) => a.avgNormalizedScore - b.avgNormalizedScore);

    for (const b of benchmarks) {
      if (b.avgNormalizedScore === null) { b.percentileRank = null; continue; }
      const rank = scored.findIndex((s) => s.cohortId === b.cohortId);
      b.percentileRank = scored.length > 1 ? Math.round((rank / (scored.length - 1)) * 100) : 50;
    }

    return { benchmarks };
  } catch (err) {
    return { error: err.message };
  }
}

async function getJudgeCalibration({ eventId }) {
  try {
    const event = await Event.findById(eventId).select('name').lean();
    if (!event) return { error: 'Event not found.' };

    const kpis = await KPI.find({ event: eventId }).lean();
    const submissions = await EvaluationSubmission.find({ event: eventId }).lean();

    if (submissions.length === 0) return { event: { id: eventId, name: trunc(event.name) }, evaluatorCount: 0, message: 'No evaluations submitted yet.' };

    // Judge-level analysis
    const judgeMap = {};
    for (const sub of submissions) {
      const judgeKey = trunc(sub.evaluatorName || 'Anonymous');
      if (!judgeMap[judgeKey]) judgeMap[judgeKey] = { normalizedScores: [], rawScores: [] };
      for (const ts of sub.teamScores) {
        for (const s of ts.scores) {
          const kpi = kpis.find((k) => k._id.toString() === s.kpi?.toString());
          if (!kpi) continue;
          judgeMap[judgeKey].rawScores.push(s.score);
          judgeMap[judgeKey].normalizedScores.push(normalizeScore(s.score, kpi));
        }
      }
    }

    const allNorm = Object.values(judgeMap).flatMap((j) => j.normalizedScores);
    const globalMean = avg(allNorm);

    const judges = Object.entries(judgeMap).map(([name, data]) => {
      const judgeAvgNorm = avg(data.normalizedScores);
      const biasDelta = globalMean !== null && judgeAvgNorm !== null
        ? Math.round(judgeAvgNorm - globalMean) : null;
      return {
        name,
        totalScoresGiven: data.rawScores.length,
        avgNormalizedScore: judgeAvgNorm !== null ? Math.round(judgeAvgNorm) : null,
        bias: biasDelta !== null
          ? (biasDelta > 8 ? `Lenient (+${biasDelta} pts vs. mean)` : biasDelta < -8 ? `Strict (${biasDelta} pts vs. mean)` : 'Well-calibrated')
          : 'N/A',
      };
    });

    // KPI inter-rater reliability
    const kpiCalibration = kpis.map((kpi) => {
      const kid = kpi._id.toString();
      const allScores = [];
      for (const sub of submissions) {
        for (const ts of sub.teamScores) {
          const s = ts.scores.find((sc) => sc.kpi?.toString() === kid);
          if (s) allScores.push(s.score);
        }
      }
      if (allScores.length < 2) return null;
      const sr = scaleRange(kpi);
      const sd = stdDev(allScores);
      const disagreementPct = Math.round((sd / sr.range) * 100);
      return {
        kpiName: trunc(kpi.name),
        judgeCount: allScores.length,
        avgRawScore: avg(allScores),
        stdDev: Math.round(sd * 100) / 100,
        disagreementLevel: disagreementPct > 25 ? 'High' : disagreementPct > 10 ? 'Medium' : 'Low',
        interpretation: disagreementPct > 25
          ? 'Judges strongly disagree — criteria may be subjective or rubric unclear'
          : disagreementPct > 10 ? 'Some disagreement — review scoring rubric'
          : 'Judges are well-aligned',
      };
    }).filter(Boolean);

    return {
      event: { id: eventId, name: trunc(event.name) },
      evaluatorCount: submissions.length,
      globalMeanNormalized: globalMean !== null ? Math.round(globalMean) : null,
      judges,
      kpiCalibration,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function getMemberCrossTeamHistory({ cohortId }) {
  try {
    const teams = await Team.find({ cohort: cohortId })
      .populate('members.trainee', 'firstName lastName')
      .populate('event', 'name')
      .lean();

    const memberMap = {};
    for (const team of teams) {
      for (const m of (team.members || [])) {
        const tid = m.trainee?._id?.toString();
        if (!tid) continue;
        const name = m.trainee ? `${m.trainee.firstName} ${m.trainee.lastName}` : 'Unknown';
        if (!memberMap[tid]) memberMap[tid] = { id: tid, name: trunc(name), teamHistory: [], allRoles: new Set() };
        memberMap[tid].teamHistory.push({
          teamId: team._id.toString(),
          teamName: trunc(team.name),
          eventName: team.event ? trunc(team.event.name) : null,
          roles: m.roles || [],
          isDissolved: team.isDissolved ?? false,
        });
        (m.roles || []).forEach((r) => memberMap[tid].allRoles.add(r));
      }
    }

    const members = Object.values(memberMap).map((m) => {
      const roles = [...m.allRoles];
      const isLeader = roles.some((r) => ['CEO', 'Lead', 'Founder', 'Director'].includes(r));
      const multiTeam = m.teamHistory.length > 1;
      return {
        id: m.id,
        name: m.name,
        allRoles: roles,
        teamsCount: m.teamHistory.length,
        teamHistory: m.teamHistory,
        isLeader,
        multiTeamMember: multiTeam,
        hasExperiencedDissolution: m.teamHistory.some((t) => t.isDissolved),
        signal: isLeader && multiTeam ? 'High-value: leadership + multi-team'
          : isLeader ? 'Leadership signal'
          : multiTeam ? 'Versatile: multi-team experience'
          : 'Standard member',
      };
    });

    // Frequent co-working pairs
    const coWorkingMap = {};
    for (const team of teams) {
      const ids = (team.members || []).map((m) => m.trainee?._id?.toString()).filter(Boolean);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join('|');
          coWorkingMap[key] = (coWorkingMap[key] || 0) + 1;
        }
      }
    }

    const frequentPairs = Object.entries(coWorkingMap)
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([key, count]) => {
        const [id1, id2] = key.split('|');
        return {
          members: [memberMap[id1]?.name ?? id1, memberMap[id2]?.name ?? id2],
          teamsTogether: count,
        };
      });

    return {
      totalMembers: members.length,
      leaders: members.filter((m) => m.isLeader),
      multiTeamMembers: members.filter((m) => m.multiTeamMember),
      membersWithDissolutionExperience: members.filter((m) => m.hasExperiencedDissolution),
      frequentPairs,
      allMembers: members.slice(0, 25),
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

const TOOLS = {
  listCohorts,
  getCohortStats,
  searchTeams,
  getTeamDeepProfile,
  listTrainees,
  getTraineeProfile,
  listEvents,
  getEventEvaluationResults,
  getTeamRankings,
  identifyAtRiskSignals,
  getTeamProgressOverTime,
  getCohortBenchmarks,
  getJudgeCalibration,
  getMemberCrossTeamHistory,
};

async function executeTool(name, args) {
  const fn = TOOLS[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(args);
}

// OpenAI-compatible tool format for HF Inference API
const HF_TOOL_DECLARATIONS = TOOL_DECLARATIONS.map((t) => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters ?? { type: 'object', properties: {} },
  },
}));

module.exports = { TOOL_DECLARATIONS, HF_TOOL_DECLARATIONS, executeTool };
