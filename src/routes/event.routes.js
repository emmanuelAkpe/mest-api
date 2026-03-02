const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { create, list, getById, update } = require('../controllers/event.controller');
const {
  createEventValidation,
  updateEventValidation,
  listEventsValidation,
} = require('../validators/event.validators');

// Cohort-scoped: POST /cohorts/:cohortId/events, GET /cohorts/:cohortId/events
const cohortRouter = Router({ mergeParams: true });
cohortRouter.use(apiLimiter);
cohortRouter.post('/', authenticate, createEventValidation, validate, create);
cohortRouter.get('/', authenticate, listEventsValidation, validate, list);

// Individual: GET /events/:id, PUT /events/:id
const individualRouter = Router();
individualRouter.use(apiLimiter);
individualRouter.get('/:id', authenticate, getById);
individualRouter.put('/:id', authenticate, updateEventValidation, validate, update);

module.exports = { cohortRouter, individualRouter };
