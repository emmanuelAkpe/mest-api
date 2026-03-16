const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { create, list, getById, update, listMemberChanges } = require('../controllers/trainee.controller');
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

module.exports = { cohortRouter, individualRouter };
