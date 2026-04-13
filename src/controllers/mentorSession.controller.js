const MentorSession = require('../models/MentorSession.model');
const Team = require('../models/Team.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');
const { createNotification } = require('../services/notification.service');

function logSessionEvent(meta) {
  logger.info('Mentor session event', meta);
}

async function listSessions(req, res, next) {
  try {
    const { teamId } = req.params;

    const team = await Team.findById(teamId).select('_id cohort');
    if (!team) {
      return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' });
    }

    const sessions = await MentorSession.find({ team: team._id })
      .populate('mentor', 'firstName lastName email role')
      .populate('loggedBy', 'firstName lastName')
      .sort({ sessionDate: -1 });

    return sendSuccess(res, 200, { data: sessions });
  } catch (err) {
    next(err);
  }
}

async function createSession(req, res, next) {
  try {
    const { teamId } = req.params;
    const { sessionDate, notes, actionItems } = req.body;

    if (!sessionDate) {
      return sendError(res, 422, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'sessionDate is required.',
      });
    }

    const team = await Team.findById(teamId).select('_id cohort mentor');
    if (!team) {
      return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' });
    }

    const mentorId = team.mentor ?? req.admin.id;

    const session = await MentorSession.create({
      team: team._id,
      cohort: team.cohort,
      mentor: mentorId,
      sessionDate: new Date(sessionDate),
      notes: notes?.trim() || undefined,
      actionItems: Array.isArray(actionItems)
        ? actionItems.map((a) => a.trim()).filter(Boolean)
        : [],
      loggedBy: req.admin.id,
    });

    logSessionEvent({
      event: 'mentor_session_created',
      sessionId: session._id,
      teamId: team._id,
      loggedBy: req.admin.id,
    });

    setImmediate(async () => {
      await createNotification({
        type: 'mentor_session_logged',
        title: 'Mentor session logged',
        body: `A mentor session was logged for team on ${new Date(sessionDate).toDateString()}.`,
        link: `/teams/${team._id}`,
        cohort: team.cohort,
      });
    });

    const populated = await session.populate([
      { path: 'mentor', select: 'firstName lastName email role' },
      { path: 'loggedBy', select: 'firstName lastName' },
    ]);

    return sendSuccess(res, 201, { data: populated, message: 'Mentor session logged.' });
  } catch (err) {
    next(err);
  }
}

async function updateSession(req, res, next) {
  try {
    const { id } = req.params;
    const { sessionDate, notes, actionItems } = req.body;

    const session = await MentorSession.findById(id);
    if (!session) {
      return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Session not found.' });
    }

    const isOwner = session.loggedBy?.toString() === req.admin.id;
    const isSuperAdmin = req.admin.role === 'super_admin';
    if (!isOwner && !isSuperAdmin) {
      return sendError(res, 403, {
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only the admin who logged this session or a super admin can update it.',
      });
    }

    if (sessionDate !== undefined) session.sessionDate = new Date(sessionDate);
    if (notes !== undefined) session.notes = notes?.trim() || undefined;
    if (actionItems !== undefined) {
      session.actionItems = Array.isArray(actionItems)
        ? actionItems.map((a) => a.trim()).filter(Boolean)
        : [];
    }

    await session.save();

    logSessionEvent({
      event: 'mentor_session_updated',
      sessionId: session._id,
      updatedBy: req.admin.id,
    });

    const populated = await session.populate([
      { path: 'mentor', select: 'firstName lastName email role' },
      { path: 'loggedBy', select: 'firstName lastName' },
    ]);

    return sendSuccess(res, 200, { data: populated, message: 'Session updated.' });
  } catch (err) {
    next(err);
  }
}

async function deleteSession(req, res, next) {
  try {
    const { id } = req.params;

    const session = await MentorSession.findByIdAndDelete(id);
    if (!session) {
      return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Session not found.' });
    }

    logSessionEvent({
      event: 'mentor_session_deleted',
      sessionId: id,
      deletedBy: req.admin.id,
    });

    return sendSuccess(res, 200, { message: 'Session deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSessions, createSession, updateSession, deleteSession };
