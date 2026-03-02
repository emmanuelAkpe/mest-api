const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { getForm, submit } = require('../controllers/evaluate.controller');
const { submitValidation } = require('../validators/evaluate.validators');

// Public routes — no authentication required
// Global rate limiter is applied app-wide, so no additional limiter here
const router = Router();

router.get('/:token', getForm);
router.post('/:token', submitValidation, validate, submit);

module.exports = router;
