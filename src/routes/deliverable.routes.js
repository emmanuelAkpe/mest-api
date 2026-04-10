const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const { create, listByEvent, updateDeliverable, deleteDeliverable, generateReview, sendReminders } = require('../controllers/deliverable.controller');

// Event-scoped: /events/:eventId/deliverables
const eventRouter = Router({ mergeParams: true });
eventRouter.post('/', authenticate, create);
eventRouter.get('/', authenticate, listByEvent);

// Individual: /deliverables/:id
const individualRouter = Router();
individualRouter.put('/:id', authenticate, updateDeliverable);
individualRouter.delete('/:id', authenticate, deleteDeliverable);
individualRouter.post('/:id/review', authenticate, generateReview);
individualRouter.post('/:id/send-reminders', authenticate, sendReminders);

module.exports = { eventRouter, individualRouter };
