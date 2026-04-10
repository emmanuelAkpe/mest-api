const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authenticate')
const { list, markRead, markAllRead } = require('../controllers/notification.controller')

router.get('/', authenticate, list)
router.patch('/:id/read', authenticate, markRead)
router.post('/mark-all-read', authenticate, markAllRead)

module.exports = router
