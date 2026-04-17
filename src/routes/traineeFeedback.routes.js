const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const { listByCohort } = require('../controllers/traineeFeedback.controller');

// GET /cohorts/:cohortId/trainee-feedback
const router = Router({ mergeParams: true });
router.get('/:cohortId/trainee-feedback', authenticate, listByCohort);

module.exports = router;
