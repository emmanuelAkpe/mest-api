const express = require('express')
const router = express.Router()
const { requestOtp, verifyOtp, getMe } = require('../controllers/traineePortal.controller')

router.post('/request-otp', requestOtp)
router.post('/verify-otp', verifyOtp)
router.get('/me', getMe)

module.exports = router
