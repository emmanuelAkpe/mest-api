const TraineeFeedback = require('../models/TraineeFeedback.model');
const Cohort = require('../models/Cohort.model');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');

async function listByCohort(req, res, next) {
  try {
    const { cohortId } = req.params;

    const cohort = await Cohort.findById(cohortId).select('_id');
    if (!cohort) {
      return sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'Cohort not found.' });
    }

    const filter = { cohort: cohort._id };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.target) filter.target = req.query.target;

    const feedback = await TraineeFeedback.find(filter)
      .populate('trainee', 'firstName lastName photo')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, { data: feedback });
  } catch (err) {
    next(err);
  }
}

module.exports = { listByCohort };
