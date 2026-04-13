const crypto = require('crypto')
const Trainee = require('../models/Trainee.model')
const TraineeFeedback = require('../models/TraineeFeedback.model')
const Team = require('../models/Team.model')
const Event = require('../models/Event.model')
const KPI = require('../models/KPI.model')
const EvaluationSubmission = require('../models/EvaluationSubmission.model')
const MentorReview = require('../models/MentorReview.model')
const FacilitatorLog = require('../models/FacilitatorLog.model')
const SubmissionLink = require('../models/SubmissionLink.model')
const TraineePortalSession = require('../models/TraineePortalSession.model')
const TraineeInsight = require('../models/TraineeInsight.model')
const { sendTraineePortalOtpEmail } = require('../services/email.service')
const { generateRawToken } = require('../utils/tokenUtils')
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response')
const { logger } = require('../utils/logger')
const { createNotification } = require('../services/notification.service')

async function requestOtp(req, res, next) {
  try {
    const { email } = req.body
    if (!email) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'email is required.' })

    const trainee = await Trainee.findOne({ email: email.toLowerCase() }).select('_id firstName')
    if (!trainee) {
      // Intentionally vague for security
      return sendSuccess(res, 200, { message: 'If that email is registered, you will receive a code.' })
    }

    const otp = crypto.randomInt(100000, 999999).toString()
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h session

    await TraineePortalSession.findOneAndUpdate(
      { trainee: trainee._id },
      { trainee: trainee._id, email: email.toLowerCase(), otpHash, otpExpiresAt, sessionToken: undefined, grantedAt: undefined, expiresAt: sessionExpiresAt },
      { upsert: true, new: true, select: '+otpHash +otpExpiresAt' }
    )

    await sendTraineePortalOtpEmail({ to: email.toLowerCase(), firstName: trainee.firstName, otp }).catch(
      err => logger.warn('Trainee portal OTP email failed', { email, err: err?.message })
    )

    sendSuccess(res, 200, { message: 'If that email is registered, you will receive a code.' })
  } catch (err) {
    next(err)
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'email and otp are required.' })

    const session = await TraineePortalSession.findOne({ email: email.toLowerCase() }).select('+otpHash +otpExpiresAt')
    if (!session?.otpHash) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Request an OTP first.' })
    if (new Date() > session.otpExpiresAt) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'OTP expired. Request a new one.' })

    const hash = crypto.createHash('sha256').update(otp).digest('hex')
    if (hash !== session.otpHash) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid OTP.' })

    const sessionToken = generateRawToken()
    session.sessionToken = sessionToken
    session.grantedAt = new Date()
    session.otpHash = undefined
    session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await session.save()

    sendSuccess(res, 200, { data: { accessToken: sessionToken, email: email.toLowerCase() }, message: 'Access granted.' })
  } catch (err) {
    next(err)
  }
}

async function resolveSession(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const session = await TraineePortalSession.findOne({ sessionToken: token }).select('+sessionToken')
  if (!session || new Date() > session.expiresAt) return null
  return session
}

async function getMe(req, res, next) {
  try {
    const session = await resolveSession(req.headers.authorization)
    if (!session) return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session.' })

    const trainee = await Trainee.findById(session.trainee)
    if (!trainee) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' })

    // Load team membership
    const team = await Team.findOne({ 'members.trainee': trainee._id, isDissolved: false })
      .populate('members.trainee', 'firstName lastName photo')
      .populate('event', 'name type startDate endDate')
      .select('name productIdea marketFocus members event')

    const eventId = team?.event?._id ?? team?.event

    // Load submission links, eval scores, mentor reviews, facilitator logs, insight in parallel
    const [submissionLinks, mentorReviews, facilitatorLogs, insight, kpis, evalSubmissions] = await Promise.all([
      team
        ? SubmissionLink.find({ team: team._id }).populate('deliverable', 'title aiReview').sort({ deadline: 1 })
        : Promise.resolve([]),
      MentorReview.find({ trainee: trainee._id })
        .populate('mentor', 'firstName lastName')
        .sort({ createdAt: -1 }),
      FacilitatorLog.find({ trainee: trainee._id })
        .populate('facilitator', 'firstName lastName')
        .sort({ createdAt: -1 }),
      TraineeInsight.findOne({ trainee: trainee._id }).sort({ createdAt: -1 }),
      eventId ? KPI.find({ event: eventId }).sort({ order: 1, createdAt: 1 }).select('name weight') : Promise.resolve([]),
      eventId ? EvaluationSubmission.find({ event: eventId }) : Promise.resolve([]),
    ])

    // Aggregate eval scores for this team
    let evaluationScores = null
    if (team && kpis.length > 0) {
      const teamIdStr = team._id.toString()
      const kpiScoreMap = {}
      for (const kpi of kpis) kpiScoreMap[kpi.id] = []
      for (const sub of evalSubmissions) {
        for (const ts of sub.teamScores) {
          if (ts.team.toString() !== teamIdStr) continue
          for (const s of ts.scores) {
            const kid = s.kpi.toString()
            if (kpiScoreMap[kid]) kpiScoreMap[kid].push(s.score)
          }
        }
      }
      const kpiResults = kpis
        .map(kpi => {
          const scores = kpiScoreMap[kpi.id] ?? []
          if (scores.length === 0) return null
          const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
          return { kpiName: kpi.name, avgScore: avg, weight: kpi.weight }
        })
        .filter(Boolean)
      const totalWeight = kpiResults.reduce((s, k) => s + k.weight, 0)
      const overallAvg = kpiResults.length > 0 && totalWeight > 0
        ? Math.round((kpiResults.reduce((s, k) => s + k.avgScore * k.weight, 0) / totalWeight) * 100) / 100
        : null
      if (overallAvg !== null) evaluationScores = { overallAvg, kpis: kpiResults }
    }

    // Format submission links
    const portalLinks = submissionLinks.map(l => {
      const deadlinePassed = new Date() > l.deadline
      const deliverable = l.deliverable
      const teamReview = deadlinePassed && deliverable?.aiReview
        ? deliverable.aiReview.teams?.find(t => t.teamId?.toString() === team?._id?.toString()) ?? null
        : null
      return {
        id: l.id,
        token: l.token,
        title: l.title,
        description: l.description ?? null,
        acceptedTypes: l.acceptedTypes,
        deadline: l.deadline,
        status: l.status,
        submissions: l.submissions,
        teamReview,
        isActive: !deadlinePassed,
      }
    })

    sendSuccess(res, 200, {
      data: {
        trainee: {
          id: trainee.id,
          firstName: trainee.firstName,
          lastName: trainee.lastName,
          email: trainee.email,
          country: trainee.country,
          photo: trainee.photo ?? null,
          bio: trainee.bio ?? null,
          education: trainee.education ?? null,
          top3Skills: trainee.top3Skills ?? null,
          coreTechSkills: trainee.coreTechSkills ?? null,
          industriesOfInterest: trainee.industriesOfInterest ?? null,
          technicalBackground: trainee.technicalBackground,
          aiSkillLevel: trainee.aiSkillLevel,
          linkedIn: trainee.linkedIn ?? null,
          github: trainee.github ?? null,
          portfolio: trainee.portfolio ?? null,
          funFact: trainee.funFact ?? null,
        },
        team: team
          ? {
              id: team.id,
              name: team.name,
              productIdea: team.productIdea ?? null,
              marketFocus: team.marketFocus ?? null,
              event: team.event,
              members: team.members.map(m => ({
                firstName: m.trainee?.firstName,
                lastName: m.trainee?.lastName,
                photo: m.trainee?.photo ?? null,
                roles: m.roles,
              })),
            }
          : null,
        submissionLinks: portalLinks,
        mentorReviews,
        facilitatorLogs,
        evaluationScores,
        insight: insight?.content ?? null,
      },
      message: 'Portal data loaded.',
    })
  } catch (err) {
    next(err)
  }
}

const FEEDBACK_AREAS = {
  mentor:     ['helpfulness', 'availability', 'guidance_quality', 'overall'],
  programme:  ['content_quality', 'pace', 'support', 'overall'],
  peer:       ['contribution', 'collaboration', 'communication', 'overall'],
}

async function submitFeedback(req, res, next) {
  try {
    const session = await resolveSession(req.headers.authorization)
    if (!session) return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session.' })

    const trainee = await Trainee.findById(session.trainee).select('_id cohort')
    if (!trainee) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Trainee not found.' })

    const { type, target, ratings, comment } = req.body

    if (!type || !FEEDBACK_AREAS[type]) {
      return sendError(res, 422, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: `type must be one of: ${Object.keys(FEEDBACK_AREAS).join(', ')}.`,
      })
    }

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return sendError(res, 422, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'ratings must be a non-empty array.',
      })
    }

    const validAreas = FEEDBACK_AREAS[type]
    for (const r of ratings) {
      if (!validAreas.includes(r.area)) {
        return sendError(res, 422, {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Invalid area "${r.area}" for type "${type}". Valid: ${validAreas.join(', ')}.`,
        })
      }
      if (typeof r.score !== 'number' || r.score < 1 || r.score > 5) {
        return sendError(res, 422, {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `score for area "${r.area}" must be a number between 1 and 5.`,
        })
      }
    }

    const targetModelMap = { mentor: 'Admin', peer: 'Trainee', programme: null }
    const targetModel = targetModelMap[type]

    const feedback = await TraineeFeedback.findOneAndUpdate(
      { trainee: trainee._id, type, target: target ?? null },
      {
        trainee: trainee._id,
        cohort: trainee.cohort,
        type,
        target: target ?? null,
        targetModel,
        ratings,
        comment: comment?.trim() || undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    setImmediate(async () => {
      await createNotification({
        type: 'trainee_feedback_submitted',
        title: 'Trainee feedback submitted',
        body: `A trainee submitted ${type} feedback.`,
        link: null,
        cohort: trainee.cohort,
      })
    })

    return sendSuccess(res, 200, { data: feedback, message: 'Feedback saved.' })
  } catch (err) {
    next(err)
  }
}

async function listMyFeedback(req, res, next) {
  try {
    const session = await resolveSession(req.headers.authorization)
    if (!session) return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session.' })

    const feedback = await TraineeFeedback.find({ trainee: session.trainee }).sort({ updatedAt: -1 })

    return sendSuccess(res, 200, { data: feedback })
  } catch (err) {
    next(err)
  }
}

module.exports = { requestOtp, verifyOtp, getMe, submitFeedback, listMyFeedback }
