const Team = require('../models/Team.model');
const TeamCompletionToken = require('../models/TeamCompletionToken.model');
const { hashEvaluationToken } = require('../utils/tokenUtils');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');

function tokenInvalid(res) {
  sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'This link is invalid or has expired.' });
}

async function resolveToken(rawToken) {
  const hash = hashEvaluationToken(rawToken);
  const token = await TeamCompletionToken.findOne({ tokenHash: hash }).select('+tokenHash');
  if (!token || token.isRevoked || token.expiresAt < new Date()) return null;
  return token;
}

async function getForm(req, res, next) {
  try {
    const token = await resolveToken(req.params.token);
    if (!token) { tokenInvalid(res); return; }

    const team = await Team.findById(token.team)
      .select('name productIdea marketFocus event')
      .populate('event', 'name');
    if (!team) { tokenInvalid(res); return; }

    sendSuccess(res, 200, {
      data: {
        team: {
          id: team._id,
          name: team.name,
          eventName: typeof team.event === 'object' ? team.event.name : null,
          productIdea: team.productIdea ?? '',
          marketFocus: team.marketFocus ?? '',
        },
        expiresAt: token.expiresAt,
        completedAt: token.completedAt ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function submit(req, res, next) {
  try {
    const token = await resolveToken(req.params.token);
    if (!token) { tokenInvalid(res); return; }

    const { productIdea, marketFocus } = req.body;

    const updates = {};
    if (productIdea !== undefined) updates.productIdea = productIdea?.trim() || undefined;
    if (marketFocus !== undefined) updates.marketFocus = marketFocus?.trim() || undefined;

    await Team.findByIdAndUpdate(token.team, { $set: updates });
    await TeamCompletionToken.findByIdAndUpdate(token._id, { completedAt: new Date() });

    sendSuccess(res, 200, { message: 'Team details updated successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getForm, submit };
