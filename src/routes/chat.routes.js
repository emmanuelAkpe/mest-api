const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/authenticate');
const { chat, listSessions, getSession } = require('../controllers/chat.controller');

const router = Router();
router.use(apiLimiter);
router.post('/', authenticate, chat);
router.get('/sessions', authenticate, listSessions);
router.get('/sessions/:id', authenticate, getSession);

module.exports = router;
