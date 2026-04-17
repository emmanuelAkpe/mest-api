const crypto = require('crypto')
const Trainee = require('../models/Trainee.model')
const Team = require('../models/Team.model')
const Event = require('../models/Event.model')
const KPI = require('../models/KPI.model')
const EvaluationSubmission = require('../models/EvaluationSubmission.model')
const EvaluationInsight = require('../models/EvaluationInsight.model')
const EvaluationFeedbackLetter = require('../models/EvaluationFeedbackLetter.model')
const SubmissionLink = require('../models/SubmissionLink.model')
const MentorSession = require('../models/MentorSession.model')
const TeamPortalSession = require('../models/TeamPortalSession.model')
const { sendTeamPortalOtpEmail, sendDeadlineReminderEmail } = require('../services/email.service')
const { uploadToS3 } = require('../services/s3.service')
const { generateRawToken } = require('../utils/tokenUtils')
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response')
const { logger } = require('../utils/logger')
const { generateSubmissionSummary } = require('../services/gemini.service')

async function requestOtp(req, res, next) {
  try {
    const { email } = req.body
    if (!email) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'email is required.' })
    }

    const trainee = await Trainee.findOne({ email: email.toLowerCase() }).select('_id firstName')
    if (!trainee) {
      return sendSuccess(res, 200, { message: 'If that email is registered, you will receive a code.' })
    }

    const team = await Team.findOne({ 'members.trainee': trainee._id, isDissolved: false }).select('_id name')
    if (!team) {
      return sendSuccess(res, 200, { message: 'If that email is registered, you will receive a code.' })
    }

    const otp = crypto.randomInt(100000, 999999).toString()
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await TeamPortalSession.findOneAndUpdate(
      { trainee: trainee._id },
      { trainee: trainee._id, team: team._id, email: email.toLowerCase(), otpHash, otpExpiresAt, sessionToken: undefined, grantedAt: undefined, expiresAt },
      { upsert: true, new: true }
    )

    sendTeamPortalOtpEmail({ to: email.toLowerCase(), firstName: trainee.firstName, teamName: team.name, otp }).catch(
      (err) => logger.warn('Team portal OTP email failed', { email, err: err?.message })
    )

    sendSuccess(res, 200, { message: 'If that email is registered, you will receive a code.' })
  } catch (err) {
    next(err)
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'email and otp are required.' })
    }

    const session = await TeamPortalSession.findOne({ email: email.toLowerCase() }).select('+otpHash +otpExpiresAt')
    if (!session?.otpHash) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Request an OTP first.' })
    }
    if (new Date() > session.otpExpiresAt) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'OTP expired. Request a new one.' })
    }

    const hash = crypto.createHash('sha256').update(otp).digest('hex')
    if (hash !== session.otpHash) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid OTP.' })
    }

    const sessionToken = generateRawToken()
    session.sessionToken = sessionToken
    session.grantedAt = new Date()
    session.otpHash = undefined
    session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await session.save()

    sendSuccess(res, 200, { data: { accessToken: sessionToken, email: email.toLowerCase() }, message: 'Access granted.' })
  } catch (err) {
    next(err)
  }
}

async function resolveSession(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const session = await TeamPortalSession.findOne({ sessionToken: token }).select('+sessionToken')
  if (!session || new Date() > session.expiresAt) return null
  return session
}

async function getPortalData(req, res, next) {
  try {
    const session = await resolveSession(req.headers.authorization)
    if (!session) {
      return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session.' })
    }

    const team = await Team.findById(session.team)
      .populate('members.trainee', 'firstName lastName photo')
      .populate('cohort', 'name year')
      .populate('event', 'name type startDate endDate')
      .populate('mentor', 'firstName lastName')

    if (!team) {
      return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' })
    }

    // Find all events where this team has been scored
    const submissions = await EvaluationSubmission.find({ 'teamScores.team': team._id })
    const eventIds = [...new Set(submissions.map((s) => s.event.toString()))]

    // Fetch event data in parallel
    const eventDataList = await Promise.all(
      eventIds.map(async (eventId) => {
        const [event, kpis, insight, feedbackLetter, submissionLinks] = await Promise.all([
          Event.findById(eventId).select('name type startDate endDate'),
          KPI.find({ event: eventId }).sort({ order: 1, createdAt: 1 }),
          EvaluationInsight.findOne({ event: eventId }),
          EvaluationFeedbackLetter.findOne({ team: team._id, event: eventId }),
          SubmissionLink.find({ team: team._id, event: eventId }).select('title deadline submissions token'),
        ])

        if (!event) return null

        // Aggregate scores for this team across all submissions for this event
        const eventSubs = submissions.filter((s) => s.event.toString() === eventId)

        const kpiMap = {}
        for (const k of kpis) {
          kpiMap[k.id] = {
            kpiName: k.name,
            scaleType: k.scaleType,
            scaleMax: k.scaleType === '1_to_5' ? 5 : k.scaleType === '1_to_10' ? 10 : k.scaleType === 'percentage' ? 100 : (k.scaleMax ?? 10),
            scores: [],
            comments: [],
            recommendations: [],
          }
        }

        const overallComments = []
        const evaluators = []
        let evalIdx = 0

        for (const sub of eventSubs) {
          for (const ts of sub.teamScores) {
            if (ts.team.toString() !== team._id.toString()) continue
            if (ts.overallComment) overallComments.push(ts.overallComment)

            const kpiScores = []
            for (const s of ts.scores) {
              const entry = kpiMap[s.kpi.toString()]
              if (!entry) continue
              entry.scores.push(s.score)
              if (s.comment) entry.comments.push(s.comment)
              if (s.recommendation) entry.recommendations.push(s.recommendation)
              kpiScores.push({
                kpiName: entry.kpiName,
                score: s.score ?? null,
                scaleMax: entry.scaleMax,
                comment: s.comment || null,
                recommendation: s.recommendation || null,
              })
            }

            if (kpiScores.length > 0 || ts.overallComment) {
              evaluators.push({
                seed: `mest-expert-${evalIdx++}`,
                overallComment: ts.overallComment || null,
                kpiScores,
              })
            }
          }
        }

        const kpiResults = Object.values(kpiMap).map((k) => ({
          kpiName: k.kpiName,
          scaleType: k.scaleType,
          scaleMax: k.scaleMax,
          avgScore: k.scores.length > 0
            ? Math.round((k.scores.reduce((a, b) => a + b, 0) / k.scores.length) * 100) / 100
            : null,
          comments: k.comments,
          recommendations: k.recommendations,
        })).filter((k) => k.avgScore !== null || k.comments.length > 0)

        const allScores = kpiResults.filter((k) => k.avgScore !== null)
        const overallAvg = allScores.length > 0
          ? Math.round(allScores.reduce((a, k) => a + (k.avgScore / k.scaleMax * 10), 0) / allScores.length * 10) / 10
          : null

        // Extract team's insight entry
        let teamInsight = null
        if (insight?.content?.teamAnalyses) {
          const analyses = Array.isArray(insight.content.teamAnalyses)
            ? insight.content.teamAnalyses
            : Object.values(insight.content.teamAnalyses)
          teamInsight = analyses.find((t) => t.teamId === team._id.toString() || t.teamName === team.name) ?? null
          if (teamInsight) {
            teamInsight = {
              verdict: teamInsight.verdict ?? null,
              strengths: teamInsight.strengths ?? [],
              improvements: teamInsight.improvements ?? [],
              readinessLevel: teamInsight.readinessLevel ?? null,
              recommendation: teamInsight.recommendation ?? null,
            }
          }
        }

        const deliverables = submissionLinks.map((sl) => ({
          id: sl._id.toString(),
          title: sl.title,
          description: sl.description ?? null,
          acceptedTypes: sl.acceptedTypes,
          deadline: sl.deadline,
          submitted: sl.submissions.length > 0,
          submissionCount: sl.submissions.length,
          submitUrl: `/submit/${sl.token}`,
        }))

        return {
          event: {
            id: event._id,
            name: event.name,
            type: event.type,
            startDate: event.startDate,
            endDate: event.endDate,
          },
          evaluation: {
            letter: feedbackLetter?.letter ?? null,
            aiSummary: feedbackLetter?.aiSummary ?? null,
            overallAvg,
            kpis: kpiResults,
            overallComments,
            evaluators,
            insight: teamInsight,
          },
          deliverables,
        }
      })
    )

    const events = eventDataList.filter(Boolean).sort((a, b) => new Date(b.event.startDate) - new Date(a.event.startDate))

    // Fire deadline reminders (fire-and-forget — 48h window)
    setImmediate(async () => {
      try {
        const now = Date.now()
        const members = await Trainee.find({ _id: { $in: team.members.map((m) => m.trainee?._id ?? m.trainee) } }).select('firstName email')
        for (const entry of events) {
          for (const d of entry.deliverables) {
            if (d.submitted) continue
            const msLeft = new Date(d.deadline).getTime() - now
            if (msLeft <= 0 || msLeft > 48 * 3600 * 1000) continue
            // Check if reminder already sent in last 24h
            const sl = await SubmissionLink.findById(d.id).select('lastReminderSentAt')
            if (sl?.lastReminderSentAt && (now - new Date(sl.lastReminderSentAt).getTime()) < 24 * 3600 * 1000) continue
            await SubmissionLink.updateOne({ _id: d.id }, { lastReminderSentAt: new Date() })
            for (const member of members) {
              if (!member.email) continue
              sendDeadlineReminderEmail({
                to: member.email, firstName: member.firstName, teamName: team.name,
                title: d.title, deadline: d.deadline,
                submissionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}${d.submitUrl}`,
              }).catch(() => {})
            }
          }
        }
      } catch (err) {
        logger.warn('Portal deadline reminder failed', { teamId: team._id, err: err?.message })
      }
    })

    // Mentor sessions
    const mentorSessions = await MentorSession.find({ team: team._id })
      .populate('mentor', 'firstName')
      .sort({ sessionDate: -1 })
      .select('sessionDate notes actionItems mentor')

    const formattedSessions = mentorSessions.map((ms) => ({
      date: ms.sessionDate,
      notes: ms.notes ?? null,
      actionItems: ms.actionItems ?? [],
      mentorFirstName: ms.mentor?.firstName ?? null,
    }))

    // Shape team response
    const teamData = {
      id: team._id,
      name: team.name,
      productIdea: team.productIdea ?? null,
      marketFocus: team.marketFocus ?? null,
      isDissolved: team.isDissolved,
      cohort: team.cohort ? { name: team.cohort.name, year: team.cohort.year } : null,
      event: team.event ? { id: team.event._id, name: team.event.name, type: team.event.type } : null,
      members: team.members.map((m) => ({
        firstName: m.trainee?.firstName ?? null,
        lastName: m.trainee?.lastName ?? null,
        photo: m.trainee?.photo ?? null,
        roles: m.roles,
      })),
      mentor: team.mentor ? { firstName: team.mentor.firstName, lastName: team.mentor.lastName } : null,
      pivots: (team.pivots ?? []).map((p) => ({
        type: p.type,
        description: p.description,
        reason: p.reason ?? null,
        wasProactive: p.wasProactive,
        createdAt: p.createdAt,
      })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    }

    sendSuccess(res, 200, { data: { team: teamData, events, mentorSessions: formattedSessions } })
  } catch (err) {
    next(err)
  }
}

async function logout(req, res, next) {
  try {
    const session = await resolveSession(req.headers.authorization)
    if (session) {
      session.sessionToken = undefined
      session.expiresAt = new Date(0)
      await session.save()
    }
    sendSuccess(res, 200, { message: 'Logged out.' })
  } catch (err) {
    next(err)
  }
}

// POST /team-portal/events/:eventId/ai-summary
// Generates (and caches) an AI narrative summary of all feedback for this team at this event
async function generateEventSummary(req, res, next) {
  try {
    const session = await resolveSession(req.headers.authorization)
    if (!session) return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session.' })

    const { eventId } = req.params
    const teamId = session.team

    // Return cached summary if available
    const existing = await EvaluationFeedbackLetter.findOne({ team: teamId, event: eventId })
    if (existing?.aiSummary) {
      return sendSuccess(res, 200, { data: { summary: existing.aiSummary, cached: true } })
    }

    const [kpis, submissions, event, team] = await Promise.all([
      KPI.find({ event: eventId }).sort({ order: 1 }),
      EvaluationSubmission.find({ event: eventId, 'teamScores.team': teamId }),
      Event.findById(eventId).select('name type'),
      Team.findById(teamId).select('name productIdea marketFocus'),
    ])

    if (!event) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' })
    if (submissions.length === 0) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'No evaluation data available yet.' })

    // Build aggregated data for this team
    const kpiMap = Object.fromEntries(kpis.map((k) => [k.id, { name: k.name, scaleType: k.scaleType, scaleMax: k.scaleType === '1_to_5' ? 5 : k.scaleType === '1_to_10' ? 10 : k.scaleType === 'percentage' ? 100 : (k.scaleMax ?? 10), scores: [], comments: [], recommendations: [] }]))
    const overallComments = []
    for (const sub of submissions) {
      for (const ts of sub.teamScores) {
        if (ts.team.toString() !== teamId.toString()) continue
        if (ts.overallComment) overallComments.push(ts.overallComment)
        for (const s of ts.scores) {
          const entry = kpiMap[s.kpi.toString()]
          if (!entry) continue
          entry.scores.push(s.score)
          if (s.comment) entry.comments.push(s.comment)
          if (s.recommendation) entry.recommendations.push(s.recommendation)
        }
      }
    }

    const kpiLines = Object.values(kpiMap).map((k) => {
      const avg = k.scores.length ? (k.scores.reduce((a, b) => a + b, 0) / k.scores.length).toFixed(1) : 'N/A'
      const lines = [`  ${k.name}: avg ${avg}/${k.scaleMax}`]
      if (k.comments.length) k.comments.forEach((c) => lines.push(`    • "${c}"`))
      if (k.recommendations.length) k.recommendations.forEach((r) => lines.push(`    → ${r}`))
      return lines.join('\n')
    }).join('\n')

    const overallBlock = overallComments.map((c) => `  • "${c}"`).join('\n')

    const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions'
    const prompt = `You are summarising expert evaluation feedback for a startup team at MEST Africa.

EVENT: ${event.name}
TEAM: ${team.name}${team.productIdea ? ` — "${team.productIdea}"` : ''}${team.marketFocus ? ` (Market: ${team.marketFocus})` : ''}
EVALUATORS: ${submissions.length}

KPI SCORES & COMMENTS:
${kpiLines}

OVERALL PANEL COMMENTS:
${overallBlock || '  (none)'}

Write a concise, honest, team-facing summary of this feedback. Speak directly to the team as "you". Do NOT mention evaluators, judges, or scores numerically. Translate scores into qualitative language. Include what they did well and what they need to work on. 2–3 short paragraphs. No headers.

Return ONLY valid JSON:
{ "summary": "<text>" }`

    const aiRes = await fetch(OPENAI_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.5, max_tokens: 600 }),
    })
    if (!aiRes.ok) throw new Error(`OpenAI error ${aiRes.status}`)
    const aiData = await aiRes.json()
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content ?? '{}')
    const summary = parsed.summary ?? null

    // Cache on the feedback letter record (upsert)
    await EvaluationFeedbackLetter.findOneAndUpdate(
      { team: teamId, event: eventId },
      { $set: { aiSummary: summary } },
      { upsert: true }
    )

    sendSuccess(res, 200, { data: { summary, cached: false } })
  } catch (err) {
    next(err)
  }
}

// POST /team-portal/deliverables/:submissionLinkId/submit
// Upload or link a submission directly from the team portal
async function submitDeliverable(req, res, next) {
  try {
    const session = await resolveSession(req.headers.authorization)
    if (!session) return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session.' })

    const { submissionLinkId } = req.params
    const link = await SubmissionLink.findById(submissionLinkId)
    if (!link) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Submission link not found.' })
    if (link.team.toString() !== session.team.toString()) return sendError(res, 403, { code: ERROR_CODES.FORBIDDEN, message: 'This submission link does not belong to your team.' })
    if (new Date() > link.deadline) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'The submission deadline has passed.' })

    let url, filename, fileType, label

    if (req.file) {
      const allowedMimes = {
        'application/pdf': 'pdf',
        'application/vnd.ms-powerpoint': 'slides',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slides',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
        'application/msword': 'document',
        'application/vnd.ms-excel': 'spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
        'text/csv': 'spreadsheet',
        'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image',
        'video/mp4': 'video', 'video/quicktime': 'video', 'video/webm': 'video',
      }
      const detectedType = allowedMimes[req.file.mimetype]
      if (!detectedType) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Unsupported file type.' })
      const result = await uploadToS3({ buffer: req.file.buffer, mimetype: req.file.mimetype, originalname: req.file.originalname, folder: 'submissions' })
      url = result.url; filename = req.file.originalname; fileType = detectedType
      label = req.body.label || req.file.originalname
    } else if (req.body.url) {
      url = req.body.url; fileType = req.body.fileType; label = req.body.label || undefined
      if (!fileType) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'fileType is required for URL submissions.' })
    } else {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Provide a file or a URL.' })
    }

    if (!link.acceptedTypes.includes(fileType)) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: `This link does not accept ${fileType} submissions.` })
    }

    // Get trainee email for submittedByEmail
    const trainee = await Trainee.findById(session.trainee).select('email')
    const submittedByEmail = trainee?.email ?? 'portal@mest.com'

    const item = { fileType, url, filename: filename || null, label: label || null, submittedByEmail, submittedAt: new Date() }
    await SubmissionLink.updateOne({ _id: link._id }, { $push: { submissions: item } })

    logger.info('Portal deliverable submitted', { teamId: session.team, linkId: submissionLinkId, fileType })
    sendSuccess(res, 201, { data: item, message: 'Submission received.' })
  } catch (err) {
    next(err)
  }
}

// DELETE /team-portal/deliverables/:submissionLinkId/submissions/:submissionId
async function deleteDeliverable(req, res, next) {
  try {
    const session = await resolveSession(req.headers.authorization)
    if (!session) return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session.' })

    const { submissionLinkId, submissionId } = req.params
    const link = await SubmissionLink.findById(submissionLinkId)
    if (!link) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Submission link not found.' })
    if (link.team.toString() !== session.team.toString()) return sendError(res, 403, { code: ERROR_CODES.FORBIDDEN, message: 'Not your team.' })

    await SubmissionLink.updateOne({ _id: link._id }, { $pull: { submissions: { _id: submissionId } } })
    sendSuccess(res, 200, { message: 'Submission removed.' })
  } catch (err) {
    next(err)
  }
}

module.exports = { requestOtp, verifyOtp, getPortalData, logout, generateEventSummary, submitDeliverable, deleteDeliverable }
