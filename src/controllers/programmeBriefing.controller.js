const Cohort = require('../models/Cohort.model')
const Team = require('../models/Team.model')
const Trainee = require('../models/Trainee.model')
const Event = require('../models/Event.model')
const EvaluationSubmission = require('../models/EvaluationSubmission.model')
const KPI = require('../models/KPI.model')
const MentorReview = require('../models/MentorReview.model')
const FacilitatorLog = require('../models/FacilitatorLog.model')
const SubmissionLink = require('../models/SubmissionLink.model')
const Deliverable = require('../models/Deliverable.model')
const ProgrammeBriefing = require('../models/ProgrammeBriefing.model')
const { generateProgrammeBriefing } = require('../services/programmeBriefing.service')
const { createNotification } = require('../services/notification.service')
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response')

async function generate(req, res, next) {
  try {
    const { cohortId } = req.params
    const cohort = await Cohort.findById(cohortId).select('name')
    if (!cohort) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Cohort not found.' })

    // Gather all data in parallel
    const [events, teams, trainees, mentorReviews, facilitatorLogs] = await Promise.all([
      Event.find({ cohort: cohortId }).select('name type status startDate endDate').sort({ startDate: 1 }),
      Team.find({ cohort: cohortId }).populate('members.trainee', 'firstName lastName email').select('name productIdea marketFocus members isDissolved status event'),
      Trainee.find({ cohort: cohortId }).select('firstName lastName email technicalBackground aiSkillLevel isActive'),
      MentorReview.find({ trainee: { $in: await Trainee.find({ cohort: cohortId }).distinct('_id') } })
        .populate('mentor', 'firstName lastName')
        .select('trainee content rating createdAt')
        .sort({ createdAt: -1 })
        .limit(50),
      FacilitatorLog.find({ trainee: { $in: await Trainee.find({ cohort: cohortId }).distinct('_id') } })
        .populate('facilitator', 'firstName lastName')
        .select('trainee note createdAt')
        .sort({ createdAt: -1 })
        .limit(50),
    ])

    const eventIds = events.map(e => e._id)

    const [kpis, evalSubmissions, deliverables, submissionLinks] = await Promise.all([
      KPI.find({ event: { $in: eventIds } }).select('name event weight scaleType'),
      EvaluationSubmission.find({ event: { $in: eventIds } }),
      Deliverable.find({ cohort: cohortId }).select('title deadline event'),
      SubmissionLink.find({ event: { $in: eventIds } }).select('team deliverable deadline submissions status event'),
    ])

    // Compute per-team eval scores
    const teamScoreMap = {}
    for (const sub of evalSubmissions) {
      for (const ts of sub.teamScores) {
        const teamId = ts.team.toString()
        if (!teamScoreMap[teamId]) teamScoreMap[teamId] = []
        const eventKpis = kpis.filter(k => k.event.toString() === sub.event.toString())
        const totalWeight = eventKpis.reduce((s, k) => s + k.weight, 0)
        if (totalWeight === 0) continue
        let weightedSum = 0
        for (const s of ts.scores) {
          const kpi = eventKpis.find(k => k._id.toString() === s.kpi.toString())
          if (kpi) weightedSum += s.score * kpi.weight
        }
        teamScoreMap[teamId].push(Math.round((weightedSum / totalWeight) * 100) / 100)
      }
    }

    // Compute submission rates per deliverable
    const submissionRates = deliverables.map(d => {
      const links = submissionLinks.filter(l => l.deliverable?.toString() === d._id.toString())
      const submitted = links.filter(l => l.submissions.length > 0).length
      return { title: d.title, deadline: d.deadline, total: links.length, submitted, rate: links.length > 0 ? Math.round((submitted / links.length) * 100) : null }
    })

    // Upcoming deadlines (next 7 days)
    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const upcomingDeadlines = deliverables
      .filter(d => new Date(d.deadline) > now && new Date(d.deadline) < in7Days)
      .map(d => ({ title: d.title, deadline: d.deadline }))

    // Build cohort data snapshot for GPT
    const cohortData = {
      cohortName: cohort.name,
      date: new Date().toISOString(),
      summary: {
        totalTrainees: trainees.length,
        activeTrainees: trainees.filter(t => t.isActive).length,
        totalTeams: teams.length,
        activeTeams: teams.filter(t => !t.isDissolved && t.status !== 'dissolved').length,
        dissolvedTeams: teams.filter(t => t.isDissolved).length,
        totalEvents: events.length,
        mentorReviewCount: mentorReviews.length,
        facilitatorLogCount: facilitatorLogs.length,
      },
      teams: teams.map(t => {
        const teamId = t._id.toString()
        const scores = teamScoreMap[teamId] ?? []
        const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null
        const teamLinks = submissionLinks.filter(l => l.team.toString() === teamId)
        const submittedCount = teamLinks.filter(l => l.submissions.length > 0).length
        return {
          name: t.name,
          productIdea: t.productIdea,
          status: t.isDissolved ? 'dissolved' : t.status,
          memberCount: t.members.length,
          avgEvalScore: avgScore,
          evalCount: scores.length,
          submissionsSubmitted: submittedCount,
          submissionsTotal: teamLinks.length,
          mentorReviewCount: mentorReviews.filter(r => t.members.some(m => m.trainee?._id?.toString() === r.trainee.toString())).length,
        }
      }),
      recentMentorFeedback: mentorReviews.slice(0, 20).map(r => ({
        traineeId: r.trainee.toString(),
        rating: r.rating,
        excerpt: r.content.slice(0, 200),
        mentor: typeof r.mentor === 'object' ? `${r.mentor.firstName} ${r.mentor.lastName}` : 'Unknown',
        date: r.createdAt,
      })),
      recentFacilitatorNotes: facilitatorLogs.slice(0, 20).map(l => ({
        traineeId: l.trainee.toString(),
        excerpt: l.note.slice(0, 200),
        facilitator: typeof l.facilitator === 'object' ? `${l.facilitator.firstName} ${l.facilitator.lastName}` : 'Unknown',
        date: l.createdAt,
      })),
      submissionRates,
      upcomingDeadlines,
      events: events.map(e => ({ name: e.name, type: e.type, status: e.status, startDate: e.startDate, endDate: e.endDate })),
    }

    const result = await generateProgrammeBriefing({ cohortData })

    // Map teamName → teamId for storage
    const teamNameToId = {}
    for (const t of teams) teamNameToId[t.name] = t._id

    const briefing = await ProgrammeBriefing.create({
      cohort: cohortId,
      generatedAt: new Date(),
      model: 'gpt-4o',
      healthScore: result.healthScore,
      summary: result.summary,
      urgentActions: result.urgentActions ?? [],
      teamHealth: (result.teamHealth ?? []).map(th => ({
        teamId: teamNameToId[th.teamName] ?? undefined,
        teamName: th.teamName,
        status: th.status,
        score: th.score,
        note: th.note,
      })),
      coachingPrompts: (result.coachingPrompts ?? []).map(cp => ({
        teamId: teamNameToId[cp.teamName] ?? undefined,
        teamName: cp.teamName,
        prompt: cp.prompt,
        focusArea: cp.focusArea,
      })),
      resourceRecommendations: result.resourceRecommendations ?? [],
      highlights: result.highlights ?? [],
    })

    setImmediate(async () => {
      try {
        await createNotification({
          type: 'ai_programme_briefing',
          title: 'Programme briefing ready',
          body: `AI generated a new programme briefing for ${cohort.name} (health score: ${result.healthScore}/100)`,
          link: `/cohorts/${cohortId}`,
          cohort: cohortId,
        })
      } catch {}
    })

    sendSuccess(res, 201, { data: briefing, message: 'Programme briefing generated.' })
  } catch (err) {
    next(err)
  }
}

async function list(req, res, next) {
  try {
    const { cohortId } = req.params
    const briefings = await ProgrammeBriefing.find({ cohort: cohortId })
      .sort({ createdAt: -1 })
      .limit(10)
    sendSuccess(res, 200, { data: briefings, meta: { total: briefings.length } })
  } catch (err) {
    next(err)
  }
}

async function getById(req, res, next) {
  try {
    const briefing = await ProgrammeBriefing.findById(req.params.id)
    if (!briefing) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Briefing not found.' })
    sendSuccess(res, 200, { data: briefing })
  } catch (err) {
    next(err)
  }
}

module.exports = { generate, list, getById }
