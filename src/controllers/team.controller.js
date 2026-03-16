const Team = require('../models/Team.model');
const Event = require('../models/Event.model');
const Cohort = require('../models/Cohort.model');
const Trainee = require('../models/Trainee.model');
const MemberChange = require('../models/MemberChange.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');
const { getIp, getUserAgent } = require('../utils/request');

function logTeamEvent(meta) {
  logger.info('Team event', meta);
}

function computeStatus(team, event) {
  if (team.isDissolved) return 'dissolved';
  const now = new Date();
  if (now < event.startDate) return 'not_started';
  if (now > event.endDate) return 'completed';
  return 'active';
}

function formatTeam(team, event) {
  return {
    id: team.id,
    cohort: team.cohort,
    event: team.event,
    parentTeam: team.parentTeam ?? null,
    name: team.name,
    productIdea: team.productIdea,
    marketFocus: team.marketFocus,
    members: team.members,
    pivots: team.pivots,
    isDissolved: team.isDissolved,
    status: computeStatus(team, event),
    createdBy: team.createdBy,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

async function validateMembers(members, eventId, excludeTeamId = null) {
  if (!members || members.length === 0) return null;

  // No duplicate trainee IDs in the request
  const traineeIds = members.map((m) => m.trainee.toString());
  const uniqueIds = new Set(traineeIds);
  if (uniqueIds.size !== traineeIds.length) {
    return { status: 400, message: 'Duplicate trainees in members list.' };
  }

  // All trainee IDs must exist
  const found = await Trainee.find({ _id: { $in: traineeIds } }).select('_id');
  if (found.length !== traineeIds.length) {
    return { status: 400, message: 'One or more trainee IDs do not exist.' };
  }

  // No trainee already on another team in the same event
  const conflictFilter = {
    event: eventId,
    'members.trainee': { $in: traineeIds },
  };
  if (excludeTeamId) conflictFilter._id = { $ne: excludeTeamId };

  const conflictingTeam = await Team.findOne(conflictFilter)
    .populate('members.trainee', 'firstName lastName');

  if (conflictingTeam) {
    const conflicted = conflictingTeam.members
      .filter((m) => traineeIds.includes(m.trainee._id.toString()))
      .map((m) => `${m.trainee.firstName} ${m.trainee.lastName}`)
      .join(', ');
    return {
      status: 409,
      message: `The following trainee(s) are already on another team in this event: ${conflicted}.`,
    };
  }

  return null;
}

async function create(req, res, next) {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).populate('cohort');
    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    if (new Date() > event.endDate) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Cannot create a team for a completed event.',
      });
      return;
    }

    if (event.cohort.isArchived) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Cannot create a team in an archived cohort.',
      });
      return;
    }

    const { name, productIdea, marketFocus, members, parentTeam } = req.body;

    if (parentTeam) {
      const parent = await Team.findById(parentTeam).select('_id');
      if (!parent) {
        sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Parent team not found.' });
        return;
      }
    }

    const memberError = await validateMembers(members, eventId);
    if (memberError) {
      sendError(res, memberError.status, {
        code: memberError.status === 409 ? ERROR_CODES.DUPLICATE_ENTRY : ERROR_CODES.VALIDATION_ERROR,
        message: memberError.message,
      });
      return;
    }

    const team = await Team.create({
      cohort: event.cohort._id,
      event: eventId,
      parentTeam: parentTeam ?? undefined,
      name,
      productIdea,
      marketFocus,
      members: members ?? [],
      createdBy: req.admin.id,
    });

    logTeamEvent({
      event: 'team_created',
      teamId: team.id,
      eventId,
      cohortId: event.cohort._id,
      name: team.name,
      createdBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 201, {
      data: formatTeam(team, event),
      message: 'Team created successfully.',
    });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select('name type startDate endDate parentEvent');
    if (!event) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
      return;
    }

    // Sessions inherit teams from their parent program — include both IDs in the filter
    const eventIds = [eventId];
    if (event.parentEvent) eventIds.push(event.parentEvent.toString());

    const page = req.query.page ?? 1;
    const limit = req.query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [teams, total] = await Promise.all([
      Team.find({ event: { $in: eventIds } })
        .populate('members.trainee', 'firstName lastName photo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Team.countDocuments({ event: { $in: eventIds } }),
    ]);

    sendSuccess(res, 200, {
      data: teams.map((t) => formatTeam(t, event)),
      meta: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const team = await Team.findById(req.params.id)
      .populate('event', 'name type startDate endDate')
      .populate('cohort', 'name year')
      .populate('members.trainee', 'firstName lastName email photo country')
      .populate('parentTeam', 'name event')
      .populate('createdBy', 'firstName lastName email')
      .populate('pivots.loggedBy', 'firstName lastName');

    if (!team) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' });
      return;
    }

    sendSuccess(res, 200, { data: formatTeam(team, team.event) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' });
      return;
    }

    if (team.isDissolved) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Dissolved teams cannot be edited.',
      });
      return;
    }

    const { name, productIdea, marketFocus, members, parentTeam } = req.body;

    if (parentTeam !== undefined) {
      const parent = await Team.findById(parentTeam).select('_id');
      if (!parent) {
        sendError(res, 400, { code: ERROR_CODES.VALIDATION_ERROR, message: 'Parent team not found.' });
        return;
      }
    }

    if (members !== undefined) {
      const memberError = await validateMembers(members, team.event.toString(), team.id);
      if (memberError) {
        sendError(res, memberError.status, {
          code: memberError.status === 409 ? ERROR_CODES.DUPLICATE_ENTRY : ERROR_CODES.VALIDATION_ERROR,
          message: memberError.message,
        });
        return;
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (productIdea !== undefined) updates.productIdea = productIdea;
    if (marketFocus !== undefined) updates.marketFocus = marketFocus;
    if (members !== undefined) updates.members = members;
    if (parentTeam !== undefined) updates.parentTeam = parentTeam;

    const event = await Event.findById(team.event).select('name type startDate endDate');

    const updated = await Team.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('members.trainee', 'firstName lastName photo')
      .populate('pivots.loggedBy', 'firstName lastName');

    logTeamEvent({
      event: 'team_updated',
      teamId: team.id,
      updatedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 200, {
      data: formatTeam(updated, event),
      message: 'Team updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

async function dissolve(req, res, next) {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' });
      return;
    }

    if (team.isDissolved) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Team is already dissolved.',
      });
      return;
    }

    team.isDissolved = true;
    await team.save();

    logTeamEvent({
      event: 'team_dissolved',
      teamId: team.id,
      dissolvedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    const event = await Event.findById(team.event).select('name type startDate endDate');

    sendSuccess(res, 200, {
      data: formatTeam(team, event),
      message: 'Team dissolved.',
    });
  } catch (err) {
    next(err);
  }
}

async function logPivot(req, res, next) {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' });
      return;
    }

    if (team.isDissolved) {
      sendError(res, 400, {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Cannot log a pivot for a dissolved team.',
      });
      return;
    }

    const { type, description, reason, wasProactive } = req.body;

    const pivotEntry = { type, description, loggedBy: req.admin.id };
    if (reason !== undefined) pivotEntry.reason = reason;
    if (wasProactive !== undefined) pivotEntry.wasProactive = wasProactive;

    const event = await Event.findById(team.event).select('name type startDate endDate');

    const updated = await Team.findByIdAndUpdate(
      req.params.id,
      { $push: { pivots: pivotEntry } },
      { new: true }
    ).populate('pivots.loggedBy', 'firstName lastName');

    logTeamEvent({
      event: 'team_pivot_logged',
      teamId: team.id,
      pivotType: type,
      loggedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 201, {
      data: formatTeam(updated, event),
      message: 'Pivot logged.',
    });
  } catch (err) {
    next(err);
  }
}

async function logMemberChange(req, res, next) {
  try {
    const team = await Team.findById(req.params.id).select('_id');
    if (!team) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' });
      return;
    }

    const { trainee, changeType, previousRoles, newRoles, reason, destinationTeam } = req.body;

    const entry = await MemberChange.create({
      team: team._id,
      trainee,
      changeType,
      previousRoles: previousRoles ?? [],
      newRoles: newRoles ?? [],
      reason: reason ?? undefined,
      destinationTeam: destinationTeam ?? undefined,
      loggedBy: req.admin.id,
    });

    sendSuccess(res, 201, { data: entry, message: 'Member change logged.' });
  } catch (err) {
    next(err);
  }
}

async function listMemberChanges(req, res, next) {
  try {
    const team = await Team.findById(req.params.id).select('_id');
    if (!team) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Team not found.' });
      return;
    }

    const changes = await MemberChange.find({ team: team._id })
      .populate('trainee', 'firstName lastName photo')
      .populate('destinationTeam', 'name')
      .sort({ createdAt: -1 });

    sendSuccess(res, 200, { data: changes });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, dissolve, logPivot, logMemberChange, listMemberChanges };
