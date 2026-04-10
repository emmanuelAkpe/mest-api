const crypto = require('crypto');
const SubmissionLink = require('../models/SubmissionLink.model');
const Team = require('../models/Team.model');
const Event = require('../models/Event.model');
const Trainee = require('../models/Trainee.model');
const EvaluationSubmission = require('../models/EvaluationSubmission.model');
const KPI = require('../models/KPI.model');
const { uploadToS3 } = require('../services/s3.service');
const { sendSubmissionOtpEmail, sendDeliverableNotificationEmail } = require('../services/email.service');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { generateRawToken } = require('../utils/tokenUtils');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');
const { createNotification } = require('../services/notification.service');

function formatLink(link) {
  return {
    id: link.id,
    token: link.token,
    event: link.event,
    team: link.team,
    deliverable: link.deliverable ?? null,
    title: link.title,
    description: link.description ?? null,
    acceptedTypes: link.acceptedTypes,
    deadline: link.deadline,
    status: link.status,
    submissions: link.submissions,
    createdBy: link.createdBy,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

async function create(req, res, next) {
  try {
    const { teamId, eventId, title, description, acceptedTypes, deadline, deliverableId } = req.body;

    if (!teamId || !eventId || !title || !acceptedTypes?.length || !deadline) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'teamId, eventId, title, acceptedTypes, and deadline are required.' });
    }

    const [team, event] = await Promise.all([
      Team.findById(teamId).select('_id'),
      Event.findById(eventId).select('_id'),
    ]);
    if (!team) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' });
    if (!event) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });

    const token = generateRawToken();

    const link = await SubmissionLink.create({
      token,
      event: eventId,
      team: teamId,
      deliverable: deliverableId || undefined,
      title: title.trim(),
      description: description?.trim() || undefined,
      acceptedTypes,
      deadline: new Date(deadline),
      createdBy: req.admin.id,
    });

    const populated = await SubmissionLink.findById(link._id)
      .populate('event', 'name')
      .populate({ path: 'team', select: 'name members', populate: { path: 'members.trainee', select: 'email firstName' } });

    // Notify team members in background
    setImmediate(() => {
      const submissionUrl = `${env.FRONTEND_URL}/submit/${link.token}`;
      for (const member of populated.team?.members ?? []) {
        const trainee = member.trainee;
        if (!trainee?.email) continue;
        sendDeliverableNotificationEmail({
          to: trainee.email,
          firstName: trainee.firstName ?? 'Team Member',
          teamName: populated.team.name,
          title: link.title,
          description: link.description,
          deadline: link.deadline,
          acceptedTypes: link.acceptedTypes,
          submissionUrl,
        }).catch(err => logger.warn('Manual link notification email failed', { to: trainee.email, err: err?.message }));
      }
    });

    sendSuccess(res, 201, {
      data: formatLink(populated),
      message: 'Submission link created.',
    });
  } catch (err) {
    next(err);
  }
}

async function listByTeam(req, res, next) {
  try {
    const { id: teamId } = req.params;
    const links = await SubmissionLink.find({ team: teamId })
      .populate('event', 'name')
      .sort({ createdAt: -1 });
    sendSuccess(res, 200, { data: links.map(formatLink), meta: { total: links.length } });
  } catch (err) {
    next(err);
  }
}

async function deleteLink(req, res, next) {
  try {
    const link = await SubmissionLink.findByIdAndDelete(req.params.id);
    if (!link) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Submission link not found.' });
    sendSuccess(res, 200, { message: 'Submission link deleted.' });
  } catch (err) {
    next(err);
  }
}

// ── Public endpoints ──────────────────────────────────────────────────────────

async function getPublic(req, res, next) {
  try {
    const link = await SubmissionLink.findOne({ token: req.params.token })
      .populate('event', 'name')
      .populate({ path: 'team', select: 'name', populate: { path: 'members.trainee', select: 'email' } });

    if (!link) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'This link is invalid or has expired.' });

    sendSuccess(res, 200, { data: formatLink(link) });
  } catch (err) {
    next(err);
  }
}

async function requestAccess(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'email is required.' });

    const link = await SubmissionLink.findOne({ token: req.params.token })
      .select('+accessSessions')
      .populate({ path: 'team', select: 'name', populate: { path: 'members.trainee', select: 'email firstName' } });

    if (!link) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'This link is invalid.' });

    const teamMembers = link.team?.members ?? [];
    const allowedEmails = teamMembers
      .map(m => m.trainee?.email?.toLowerCase())
      .filter(Boolean);

    if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
      return sendError(res, 403, { code: ERROR_CODES.FORBIDDEN, message: 'This email is not associated with this team. Use the email address you registered with MEST.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Upsert access session for this email
    const sessions = link.accessSessions || [];
    const idx = sessions.findIndex(s => s.email === email.toLowerCase());
    if (idx >= 0) {
      sessions[idx].otpHash = otpHash;
      sessions[idx].otpExpiresAt = otpExpiresAt;
      sessions[idx].sessionToken = undefined;
      sessions[idx].grantedAt = undefined;
    } else {
      sessions.push({ email: email.toLowerCase(), otpHash, otpExpiresAt });
    }

    await SubmissionLink.updateOne({ _id: link._id }, { $set: { accessSessions: sessions } });

    const teamName = link.team?.name ?? 'your team';
    await sendSubmissionOtpEmail({ to: email, teamName, otp, title: link.title }).catch(err =>
      logger.warn('Submission OTP email failed', { email, err: err?.message })
    );

    sendSuccess(res, 200, { message: 'OTP sent. Check your email.' });
  } catch (err) {
    next(err);
  }
}

async function verifyAccess(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'email and otp are required.' });

    const link = await SubmissionLink.findOne({ token: req.params.token }).select('+accessSessions');
    if (!link) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'This link is invalid.' });

    const session = link.accessSessions?.find(s => s.email === email.toLowerCase());
    if (!session?.otpHash) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Request an OTP first.' });
    if (new Date() > session.otpExpiresAt) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'OTP expired. Request a new one.' });

    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    if (hash !== session.otpHash) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid OTP.' });

    const sessionToken = generateRawToken();
    await SubmissionLink.updateOne(
      { _id: link._id, 'accessSessions.email': email.toLowerCase() },
      { $set: { 'accessSessions.$.sessionToken': sessionToken, 'accessSessions.$.grantedAt': new Date(), 'accessSessions.$.otpHash': null } }
    );

    sendSuccess(res, 200, { data: { accessToken: sessionToken, submitterEmail: email.toLowerCase() } });
  } catch (err) {
    next(err);
  }
}

async function resolveSession(token, authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const sessionToken = authHeader.slice(7);
  const link = await SubmissionLink.findOne({ token }).select('+accessSessions');
  if (!link) return null;
  const session = link.accessSessions?.find(s => s.sessionToken === sessionToken);
  if (!session) return null;
  return { link, session };
}

async function submitFile(req, res, next) {
  try {
    const resolved = await resolveSession(req.params.token, req.headers.authorization);
    if (!resolved) return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session. Verify your OTP again.' });

    const { link, session } = resolved;

    if (new Date() > link.deadline) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'The submission deadline has passed.' });
    }

    let url, filename, fileType, label;

    if (req.file) {
      // File upload — upload to S3
      const allowedMimes = {
        'application/pdf': 'pdf',
        'application/vnd.ms-powerpoint': 'slides',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slides',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
        'application/msword': 'document',
        'application/vnd.ms-excel': 'spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
        'text/csv': 'spreadsheet',
        'image/jpeg': 'image',
        'image/png': 'image',
        'image/webp': 'image',
        'image/gif': 'image',
        'video/mp4': 'video',
        'video/quicktime': 'video',
        'video/webm': 'video',
      };

      const detectedType = allowedMimes[req.file.mimetype];
      if (!detectedType) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Unsupported file type.' });

      const result = await uploadToS3({ buffer: req.file.buffer, mimetype: req.file.mimetype, originalname: req.file.originalname, folder: 'submissions' });
      url = result.url;
      filename = req.file.originalname;
      fileType = detectedType;
      label = req.body.label || req.file.originalname;
    } else if (req.body.url) {
      // URL submission
      url = req.body.url;
      fileType = req.body.fileType;
      label = req.body.label || undefined;
      if (!fileType) return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'fileType is required for URL submissions.' });
    } else {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Provide a file or a URL.' });
    }

    if (!link.acceptedTypes.includes(fileType)) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: `This link does not accept ${fileType} submissions.` });
    }

    const item = { fileType, url, filename: filename || null, label: label || null, submittedByEmail: session.email, submittedAt: new Date() };
    await SubmissionLink.updateOne({ _id: link._id }, { $push: { submissions: item } });

    setImmediate(async () => {
      try {
        const populated = await SubmissionLink.findById(link._id).populate('team', 'name').populate('event', 'name cohort');
        const teamName = populated?.team?.name ?? 'A team';
        const cohort = populated?.event?.cohort ?? null;
        await createNotification({
          type: 'submission_received',
          title: 'New submission received',
          body: `${teamName} submitted "${link.title}"`,
          link: `/events/${link.event}`,
          cohort,
        });
      } catch {}
    });

    sendSuccess(res, 201, { data: item, message: 'Submission received.' });
  } catch (err) {
    next(err);
  }
}

async function deleteSubmission(req, res, next) {
  try {
    const resolved = await resolveSession(req.params.token, req.headers.authorization);
    if (!resolved) return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session.' });

    const { link } = resolved;
    const submission = link.submissions.id(req.params.submissionId);
    if (!submission) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Submission not found.' });

    await SubmissionLink.updateOne({ _id: link._id }, { $pull: { submissions: { _id: submission._id } } });
    sendSuccess(res, 200, { message: 'Submission removed.' });
  } catch (err) {
    next(err);
  }
}

async function getTeamPortal(req, res, next) {
  try {
    const resolved = await resolveSession(req.params.token, req.headers.authorization);
    if (!resolved) return sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired session. Verify your OTP again.' });

    const { link, session } = resolved;

    // Load full team details
    const team = await Team.findById(link.team)
      .populate('members.trainee', 'firstName lastName photo roles')
      .select('name productIdea marketFocus members event');

    const eventId = team?.event || link.event;

    // Load all submission links for this team
    const allLinks = await SubmissionLink.find({ team: link.team })
      .populate('deliverable', 'title aiReview')
      .sort({ deadline: 1 });

    // Load event name and evaluation scores in parallel
    const [event, kpis, evalSubmissions] = await Promise.all([
      Event.findById(eventId).select('name'),
      KPI.find({ event: eventId }).sort({ order: 1, createdAt: 1 }).select('name weight scaleType'),
      EvaluationSubmission.find({ event: eventId }),
    ]);

    // Aggregate evaluation scores for this specific team
    const teamIdStr = link.team.toString();
    const kpiScoreMap = {};
    for (const kpi of kpis) kpiScoreMap[kpi.id] = [];
    for (const sub of evalSubmissions) {
      for (const ts of sub.teamScores) {
        if (ts.team.toString() !== teamIdStr) continue;
        for (const s of ts.scores) {
          const kid = s.kpi.toString();
          if (kpiScoreMap[kid]) kpiScoreMap[kid].push(s.score);
        }
      }
    }
    const kpiResults = kpis
      .map(kpi => {
        const scores = kpiScoreMap[kpi.id] ?? [];
        if (scores.length === 0) return null;
        const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
        return { kpiName: kpi.name, avgScore: avg, weight: kpi.weight };
      })
      .filter(Boolean);
    const totalWeight = kpiResults.reduce((s, k) => s + k.weight, 0);
    const overallAvg = kpiResults.length > 0 && totalWeight > 0
      ? Math.round((kpiResults.reduce((s, k) => s + k.avgScore * k.weight, 0) / totalWeight) * 100) / 100
      : null;
    const evaluationScores = overallAvg !== null ? { overallAvg, kpis: kpiResults } : null;

    const portalLinks = allLinks.map(l => {
      const deadlinePassed = new Date() > l.deadline;
      const deliverable = l.deliverable;
      // Only expose AI review if deadline has passed and review exists
      const aiReview = (deadlinePassed && deliverable?.aiReview?.teams?.length)
        ? deliverable.aiReview
        : null;

      // Find this team's review from the deliverable's aiReview
      let teamReview = null;
      if (aiReview) {
        teamReview = aiReview.teams.find(t => t.teamId?.toString() === link.team?.toString()) ?? null;
      }

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
        isActive: l.token === req.params.token,
      };
    });

    sendSuccess(res, 200, {
      data: {
        team: {
          name: team?.name ?? 'Your Team',
          productIdea: team?.productIdea ?? null,
          marketFocus: team?.marketFocus ?? null,
          members: (team?.members ?? []).map(m => ({
            firstName: m.trainee?.firstName,
            lastName: m.trainee?.lastName,
            photo: m.trainee?.photo ?? null,
            roles: m.roles,
          })),
        },
        event: { name: event?.name ?? '' },
        submissionLinks: portalLinks,
        submitterEmail: session.email,
        evaluationScores,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function adminDeleteSubmission(req, res, next) {
  try {
    const link = await SubmissionLink.findById(req.params.id);
    if (!link) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Submission link not found.' });

    const submission = link.submissions.id(req.params.submissionId);
    if (!submission) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Submission not found.' });

    await SubmissionLink.updateOne({ _id: link._id }, { $pull: { submissions: { _id: submission._id } } });
    sendSuccess(res, 200, { message: 'Submission removed.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listByTeam, deleteLink, getPublic, requestAccess, verifyAccess, submitFile, deleteSubmission, adminDeleteSubmission, getTeamPortal };
