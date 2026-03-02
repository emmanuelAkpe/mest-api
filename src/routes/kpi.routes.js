const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { list, create, update, remove } = require('../controllers/kpi.controller');
const { createKPIValidation, updateKPIValidation } = require('../validators/kpi.validators');

// Event-scoped: GET /events/:eventId/kpis, POST /events/:eventId/kpis
const eventRouter = Router({ mergeParams: true });
eventRouter.use(apiLimiter);
eventRouter.get('/', authenticate, list);
eventRouter.post('/', authenticate, createKPIValidation, validate, create);

// Individual: PUT /kpis/:id, DELETE /kpis/:id
const individualRouter = Router();
individualRouter.use(apiLimiter);
individualRouter.put('/:id', authenticate, updateKPIValidation, validate, update);
individualRouter.delete('/:id', authenticate, remove);

module.exports = { eventRouter, individualRouter };
