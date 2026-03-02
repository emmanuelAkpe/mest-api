const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { create, list, getById, update, dissolve, logPivot } = require('../controllers/team.controller');
const {
  createTeamValidation,
  updateTeamValidation,
  logPivotValidation,
  listTeamsValidation,
} = require('../validators/team.validators');

// Event-scoped: POST /events/:eventId/teams, GET /events/:eventId/teams
const eventRouter = Router({ mergeParams: true });
eventRouter.use(apiLimiter);
eventRouter.post('/', authenticate, createTeamValidation, validate, create);
eventRouter.get('/', authenticate, listTeamsValidation, validate, list);

// Individual: GET /teams/:id, PUT /teams/:id, POST /teams/:id/dissolve, POST /teams/:id/pivots
const individualRouter = Router();
individualRouter.use(apiLimiter);
individualRouter.get('/:id', authenticate, getById);
individualRouter.put('/:id', authenticate, updateTeamValidation, validate, update);
individualRouter.post('/:id/dissolve', authenticate, dissolve);
individualRouter.post('/:id/pivots', authenticate, logPivotValidation, validate, logPivot);

module.exports = { eventRouter, individualRouter };
