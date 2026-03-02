const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { create, list, results, revoke } = require('../controllers/evaluationLink.controller');
const { createLinkValidation } = require('../validators/evaluationLink.validators');

// Event-scoped: POST /events/:eventId/evaluation-links, GET /events/:eventId/evaluation-links
// GET /events/:eventId/evaluation-links/results
const eventRouter = Router({ mergeParams: true });
eventRouter.use(apiLimiter);
eventRouter.post('/', authenticate, createLinkValidation, validate, create);
eventRouter.get('/', authenticate, list);
eventRouter.get('/results', authenticate, results);

// Individual: DELETE /evaluation-links/:id
const individualRouter = Router();
individualRouter.use(apiLimiter);
individualRouter.delete('/:id', authenticate, revoke);

module.exports = { eventRouter, individualRouter };
