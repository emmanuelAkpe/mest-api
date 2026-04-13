const express = require('express')
const router = express.Router()
const { requestOtp, verifyOtp, getMe, submitFeedback, listMyFeedback } = require('../controllers/traineePortal.controller')

router.post('/request-otp', requestOtp)
router.post('/verify-otp', verifyOtp)
router.get('/me', getMe)
router.post('/feedback', submitFeedback)
router.get('/feedback', listMyFeedback)

module.exports = router
