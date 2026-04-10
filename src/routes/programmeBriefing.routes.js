const express = require('express')
const router = express.Router({ mergeParams: true })
const { authenticate } = require('../middleware/authenticate')
const { generate, list, getById } = require('../controllers/programmeBriefing.controller')

router.post('/', authenticate, generate)
router.get('/', authenticate, list)
router.get('/:id', authenticate, getById)

module.exports = router
