const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { create, list, getById, update, listMemberChanges, getInsights, generateInsights, listMentorReviews, createMentorReview, listFacilitatorLogs, createFacilitatorLog, sendProfileLink, revokeProfileLink } = require('../controllers/trainee.controller');
const {
  createTraineeValidation,
  updateTraineeValidation,
  listTraineesValidation,
} = require('../validators/trainee.validators');

// Cohort-scoped: POST /cohorts/:cohortId/trainees, GET /cohorts/:cohortId/trainees
const cohortRouter = Router({ mergeParams: true });
cohortRouter.use(apiLimiter);
cohortRouter.post('/', authenticate, createTraineeValidation, validate, create);
cohortRouter.get('/', authenticate, listTraineesValidation, validate, list);

// Individual: GET /trainees/:id, PUT /trainees/:id
const individualRouter = Router();
individualRouter.use(apiLimiter);
individualRouter.get('/:id', authenticate, getById);
individualRouter.put('/:id', authenticate, updateTraineeValidation, validate, update);
individualRouter.get('/:id/member-changes', authenticate, listMemberChanges);
individualRouter.get('/:id/insights', authenticate, getInsights);
individualRouter.post('/:id/insights/generate', authenticate, generateInsights);
individualRouter.get('/:id/mentor-reviews', authenticate, listMentorReviews);
individualRouter.post('/:id/mentor-reviews', authenticate, createMentorReview);
individualRouter.get('/:id/facilitator-logs', authenticate, listFacilitatorLogs);
individualRouter.post('/:id/facilitator-logs', authenticate, createFacilitatorLog);
individualRouter.post('/:id/profile-link', authenticate, sendProfileLink);
individualRouter.post('/:id/profile-link/resend', authenticate, sendProfileLink);
individualRouter.delete('/:id/profile-link', authenticate, revokeProfileLink);

module.exports = { cohortRouter, individualRouter };
