const Trainee = require('../models/Trainee.model');
const ProfileCompletionToken = require('../models/ProfileCompletionToken.model');
const { hashEvaluationToken } = require('../utils/tokenUtils');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');

function tokenInvalid(res) {
  sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'This link is invalid or has expired.' });
}

async function resolveToken(rawToken) {
  const hash = hashEvaluationToken(rawToken);
  const token = await ProfileCompletionToken.findOne({ tokenHash: hash }).select('+tokenHash');
  if (!token || token.isRevoked || token.expiresAt < new Date()) return null;
  return token;
}

async function getForm(req, res, next) {
  try {
    const token = await resolveToken(req.params.token);
    if (!token) { tokenInvalid(res); return; }

    const trainee = await Trainee.findById(token.trainee)
      .select('firstName lastName photo bio education top3Skills coreTechSkills industriesOfInterest whyMEST linkedIn github portfolio funFact');
    if (!trainee) { tokenInvalid(res); return; }

    sendSuccess(res, 200, {
      data: {
        trainee: {
          id: trainee._id,
          firstName: trainee.firstName,
          lastName: trainee.lastName,
          photo: trainee.photo ?? null,
          bio: trainee.bio ?? '',
          linkedIn: trainee.linkedIn ?? '',
          github: trainee.github ?? '',
          education: trainee.education ?? '',
          top3Skills: trainee.top3Skills ?? '',
          coreTechSkills: trainee.coreTechSkills ?? '',
          industriesOfInterest: trainee.industriesOfInterest ?? '',
          whyMEST: trainee.whyMEST ?? '',
          portfolio: trainee.portfolio ?? '',
          funFact: trainee.funFact ?? '',
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

    const { photo, bio, education, top3Skills, coreTechSkills, industriesOfInterest, whyMEST, linkedIn, github, portfolio, funFact } = req.body;

    const updates = {};
    if (photo !== undefined) updates.photo = photo?.trim() || undefined;
    if (bio !== undefined) updates.bio = bio?.trim() || undefined;
    if (education !== undefined) updates.education = education?.trim() || undefined;
    if (top3Skills !== undefined) updates.top3Skills = top3Skills?.trim() || undefined;
    if (coreTechSkills !== undefined) updates.coreTechSkills = coreTechSkills?.trim() || undefined;
    if (industriesOfInterest !== undefined) updates.industriesOfInterest = industriesOfInterest?.trim() || undefined;
    if (whyMEST !== undefined) updates.whyMEST = whyMEST?.trim() || undefined;
    if (linkedIn !== undefined) updates.linkedIn = linkedIn?.trim() || undefined;
    if (github !== undefined) updates.github = github?.trim() || undefined;
    if (portfolio !== undefined) updates.portfolio = portfolio?.trim() || undefined;
    if (funFact !== undefined) updates.funFact = funFact?.trim() || undefined;

    await Trainee.findByIdAndUpdate(token.trainee, { $set: updates });
    await ProfileCompletionToken.findByIdAndUpdate(token._id, { completedAt: new Date() });

    sendSuccess(res, 200, { message: 'Profile updated successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getForm, submit };
