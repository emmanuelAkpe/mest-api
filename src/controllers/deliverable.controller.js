const Deliverable = require('../models/Deliverable.model');
const SubmissionLink = require('../models/SubmissionLink.model');
const Team = require('../models/Team.model');
const Event = require('../models/Event.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { generateRawToken } = require('../utils/tokenUtils');
const { generateDeliverableReview } = require('../services/deliverableReview.service');
const { sendDeliverableNotificationEmail, sendDeadlineReminderEmail } = require('../services/email.service');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');
const { createNotification } = require('../services/notification.service');

function formatDeliverable(d, links = []) {
  return {
    id: d.id,
    event: d.event,
    cohort: d.cohort,
    title: d.title,
    description: d.description ?? null,
    acceptedTypes: d.acceptedTypes,
    deadline: d.deadline,
    targetType: d.targetType,
    aiReview: d.aiReview ?? null,
    submissionLinks: links,
    createdBy: d.createdBy,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

async function create(req, res, next) {
  try {
    const { eventId } = req.params;
    const { title, description, acceptedTypes, deadline } = req.body;

    if (!title || !acceptedTypes?.length || !deadline) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'title, acceptedTypes, and deadline are required.' });
    }

    const event = await Event.findById(eventId).select('_id cohort');
    if (!event) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });

    const deliverable = await Deliverable.create({
      event: eventId,
      cohort: event.cohort,
      title: title.trim(),
      description: description?.trim() || undefined,
      acceptedTypes,
      deadline: new Date(deadline),
      createdBy: req.admin.id,
    });

    const teams = await Team.find({ event: eventId })
      .select('_id name members')
      .populate('members.trainee', 'email firstName');

    let linksCreated = 0;
    if (teams.length > 0) {
      const linkDocs = teams.map(team => ({
        token: generateRawToken(),
        event: eventId,
        team: team._id,
        deliverable: deliverable._id,
        title: deliverable.title,
        description: deliverable.description,
        acceptedTypes: deliverable.acceptedTypes,
        deadline: deliverable.deadline,
        createdBy: req.admin.id,
      }));
      const inserted = await SubmissionLink.insertMany(linkDocs);
      linksCreated = inserted.length;

      // Send notification emails in background (don't block response)
      const frontendUrl = env.FRONTEND_URL;
      setImmediate(async () => {
        for (let i = 0; i < teams.length; i++) {
          const team = teams[i];
          const link = inserted[i];
          const submissionUrl = `${frontendUrl}/submit/${link.token}`;
          for (const member of team.members ?? []) {
            const trainee = member.trainee;
            if (!trainee?.email) continue;
            sendDeliverableNotificationEmail({
              to: trainee.email,
              firstName: trainee.firstName ?? 'Team Member',
              teamName: team.name,
              title: deliverable.title,
              description: deliverable.description,
              deadline: deliverable.deadline,
              acceptedTypes: deliverable.acceptedTypes,
              submissionUrl,
            }).catch(err => logger.warn('Deliverable notification email failed', { to: trainee.email, err: err?.message }));
          }
        }
      });
    }

    sendSuccess(res, 201, {
      data: { deliverable: formatDeliverable(deliverable), linksCreated },
      message: `Deliverable created with ${linksCreated} submission link${linksCreated !== 1 ? 's' : ''}.`,
    });
  } catch (err) {
    next(err);
  }
}

async function listByEvent(req, res, next) {
  try {
    const { eventId } = req.params;
    const deliverables = await Deliverable.find({ event: eventId }).sort({ createdAt: -1 });

    const ids = deliverables.map(d => d._id);
    const links = await SubmissionLink.find({ deliverable: { $in: ids } })
      .populate('team', 'name')
      .select('-accessSessions');

    const linksByDeliverable = {};
    for (const link of links) {
      const key = link.deliverable.toString();
      if (!linksByDeliverable[key]) linksByDeliverable[key] = [];
      linksByDeliverable[key].push(link);
    }

    const data = deliverables.map(d =>
      formatDeliverable(d, linksByDeliverable[d._id.toString()] ?? [])
    );

    sendSuccess(res, 200, { data, meta: { total: data.length } });
  } catch (err) {
    next(err);
  }
}

async function updateDeliverable(req, res, next) {
  try {
    const { title, description, deadline, acceptedTypes } = req.body;
    const updates = {};
    if (title) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || undefined;
    if (deadline) updates.deadline = new Date(deadline);
    if (acceptedTypes?.length) updates.acceptedTypes = acceptedTypes;

    const deliverable = await Deliverable.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!deliverable) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Deliverable not found.' });

    sendSuccess(res, 200, { data: formatDeliverable(deliverable), message: 'Deliverable updated.' });
  } catch (err) {
    next(err);
  }
}

async function deleteDeliverable(req, res, next) {
  try {
    const deliverable = await Deliverable.findByIdAndDelete(req.params.id);
    if (!deliverable) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Deliverable not found.' });

    await SubmissionLink.deleteMany({ deliverable: deliverable._id });

    sendSuccess(res, 200, { message: 'Deliverable and associated submission links deleted.' });
  } catch (err) {
    next(err);
  }
}

async function generateReview(req, res, next) {
  try {
    const deliverable = await Deliverable.findById(req.params.id);
    if (!deliverable) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Deliverable not found.' });

    const links = await SubmissionLink.find({ deliverable: deliverable._id })
      .populate('team', 'name members')
      .select('+accessSessions');

    const review = await generateDeliverableReview({ deliverable, links });

    await Deliverable.findByIdAndUpdate(deliverable._id, { aiReview: review });

    setImmediate(async () => {
      try {
        const event = await Event.findById(deliverable.event).select('name cohort');
        await createNotification({
          type: 'ai_review_ready',
          title: 'AI review ready',
          body: `AI review generated for "${deliverable.title}" (${review.teams?.length ?? 0} team${review.teams?.length !== 1 ? 's' : ''})`,
          link: `/events/${deliverable.event}`,
          cohort: event?.cohort ?? null,
        });
      } catch {}
    });

    sendSuccess(res, 200, { data: review, message: 'AI review generated.' });
  } catch (err) {
    next(err);
  }
}

async function sendReminders(req, res, next) {
  try {
    const deliverable = await Deliverable.findById(req.params.id);
    if (!deliverable) return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Deliverable not found.' });

    if (new Date() > deliverable.deadline) {
      return sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Deadline has already passed.' });
    }

    const links = await SubmissionLink.find({ deliverable: deliverable._id })
      .populate({ path: 'team', select: 'name members', populate: { path: 'members.trainee', select: 'email firstName' } });

    const pendingLinks = links.filter(l => l.submissions.length === 0);
    const frontendUrl = env.FRONTEND_URL;
    let emailsSent = 0;

    for (const link of pendingLinks) {
      const team = link.team;
      const submissionUrl = `${frontendUrl}/submit/${link.token}`;
      for (const member of team?.members ?? []) {
        const trainee = member.trainee;
        if (!trainee?.email) continue;
        await sendDeadlineReminderEmail({
          to: trainee.email,
          firstName: trainee.firstName ?? 'Team Member',
          teamName: team.name,
          title: deliverable.title,
          deadline: deliverable.deadline,
          submissionUrl,
        }).catch(err => logger.warn('Reminder email failed', { to: trainee.email, err: err?.message }));
        emailsSent++;
      }
    }

    sendSuccess(res, 200, {
      data: { pendingTeams: pendingLinks.length, emailsSent },
      message: `Reminders sent to ${pendingLinks.length} team${pendingLinks.length !== 1 ? 's' : ''} (${emailsSent} email${emailsSent !== 1 ? 's' : ''}).`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listByEvent, updateDeliverable, deleteDeliverable, generateReview, sendReminders };
