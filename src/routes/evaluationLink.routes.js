const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { create, list, getLink, results, generateTeamLetters, sendTeamFeedback, summarizeSubmission, resend, revoke, extend, getInsights, generateInsights } = require('../controllers/evaluationLink.controller');
const { createLinkValidation } = require('../validators/evaluationLink.validators');

// Event-scoped: POST /events/:eventId/evaluation-links, GET /events/:eventId/evaluation-links
// GET /events/:eventId/evaluation-links/results
const eventRouter = Router({ mergeParams: true });
eventRouter.post('/', authenticate, createLinkValidation, validate, create);
eventRouter.get('/', authenticate, list);
eventRouter.get('/results', authenticate, results);
eventRouter.get('/insights', authenticate, getInsights);
eventRouter.post('/insights/generate', authenticate, generateInsights);
eventRouter.post('/generate-team-letters', authenticate, generateTeamLetters);
eventRouter.post('/send-team-feedback', authenticate, sendTeamFeedback);

// Individual: GET /evaluation-links/:id, DELETE /evaluation-links/:id, POST /evaluation-links/:id/resend
const individualRouter = Router();
individualRouter.get('/:id', authenticate, getLink);
individualRouter.post('/:id/summarize', authenticate, summarizeSubmission);
individualRouter.post('/:id/resend', authenticate, resend);
individualRouter.post('/:id/extend', authenticate, extend);
individualRouter.delete('/:id', authenticate, revoke);

module.exports = { eventRouter, individualRouter };
