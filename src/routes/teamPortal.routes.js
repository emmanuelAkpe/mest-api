const { Router } = require('express')
const multer = require('multer')
const { requestOtp, verifyOtp, getPortalData, logout, generateEventSummary, submitDeliverable, deleteDeliverable } = require('../controllers/teamPortal.controller')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } })

const router = Router()

router.post('/request-otp', requestOtp)
router.post('/verify-otp', verifyOtp)
router.get('/me', getPortalData)
router.post('/logout', logout)
router.post('/events/:eventId/ai-summary', generateEventSummary)
router.post('/deliverables/:submissionLinkId/submit', upload.single('file'), submitDeliverable)
router.delete('/deliverables/:submissionLinkId/submissions/:submissionId', deleteDeliverable)

module.exports = router
