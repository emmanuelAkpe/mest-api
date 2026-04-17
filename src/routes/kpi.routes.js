const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { list, create, update, remove, generate } = require('../controllers/kpi.controller');
const { createKPIValidation, updateKPIValidation } = require('../validators/kpi.validators');

// Event-scoped: GET /events/:eventId/kpis, POST /events/:eventId/kpis
const eventRouter = Router({ mergeParams: true });
eventRouter.get('/', authenticate, list);
eventRouter.post('/generate', authenticate, generate);
eventRouter.post('/', authenticate, createKPIValidation, validate, create);

// Individual: PUT /kpis/:id, DELETE /kpis/:id
const individualRouter = Router();
individualRouter.put('/:id', authenticate, updateKPIValidation, validate, update);
individualRouter.delete('/:id', authenticate, remove);

module.exports = { eventRouter, individualRouter };
