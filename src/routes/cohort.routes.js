const { Router } = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { create, list, getById, update, archive, getDashboardStats, getAnalytics } = require('../controllers/cohort.controller');
const {
  createCohortValidation,
  updateCohortValidation,
  listCohortValidation,
} = require('../validators/cohort.validators');

const router = Router();

router.use(apiLimiter);

router.post('/', authenticate, createCohortValidation, validate, create);
router.get('/', authenticate, listCohortValidation, validate, list);
router.get('/:id', authenticate, getById);
router.put('/:id', authenticate, updateCohortValidation, validate, update);
router.post('/:id/archive', authenticate, archive);
router.get('/:id/stats', authenticate, getDashboardStats);
router.get('/:id/analytics', authenticate, getAnalytics);

module.exports = router;
