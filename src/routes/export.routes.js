const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const { exportEvaluationResults, exportSubmissions, exportTrainees } = require('../controllers/export.controller');

const router = Router();

router.get('/events/:eventId/export/evaluations', authenticate, exportEvaluationResults);
router.get('/events/:eventId/export/submissions', authenticate, exportSubmissions);
router.get('/cohorts/:cohortId/export/trainees', authenticate, exportTrainees);

module.exports = router;
