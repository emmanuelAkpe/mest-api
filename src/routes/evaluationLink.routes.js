const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { create, list, results, resend, revoke, getInsights, generateInsights } = require('../controllers/evaluationLink.controller');
const { createLinkValidation } = require('../validators/evaluationLink.validators');

// Event-scoped: POST /events/:eventId/evaluation-links, GET /events/:eventId/evaluation-links
// GET /events/:eventId/evaluation-links/results
const eventRouter = Router({ mergeParams: true });
eventRouter.post('/', authenticate, createLinkValidation, validate, create);
eventRouter.get('/', authenticate, list);
eventRouter.get('/results', authenticate, results);
eventRouter.get('/insights', authenticate, getInsights);
eventRouter.post('/insights/generate', authenticate, generateInsights);

// Individual: DELETE /evaluation-links/:id, POST /evaluation-links/:id/resend
const individualRouter = Router();
individualRouter.post('/:id/resend', authenticate, resend);
individualRouter.delete('/:id', authenticate, revoke);

module.exports = { eventRouter, individualRouter };
