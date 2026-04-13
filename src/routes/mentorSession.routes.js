const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { listSessions, createSession, updateSession, deleteSession } = require('../controllers/mentorSession.controller');

// Team-scoped: GET/POST /teams/:teamId/mentor-sessions
const teamRouter = Router({ mergeParams: true });
teamRouter.use(apiLimiter);
teamRouter.get('/:teamId/mentor-sessions', authenticate, listSessions);
teamRouter.post('/:teamId/mentor-sessions', authenticate, createSession);

// Individual session: PATCH/DELETE /mentor-sessions/:id
const sessionRouter = Router();
sessionRouter.use(apiLimiter);
sessionRouter.patch('/mentor-sessions/:id', authenticate, updateSession);
sessionRouter.delete('/mentor-sessions/:id', authenticate, requireRole('super_admin'), deleteSession);

module.exports = { teamRouter, sessionRouter };
