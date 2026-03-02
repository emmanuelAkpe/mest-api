const { body, query } = require('express-validator');

const createCohortValidation = [
  body('name').trim().notEmpty().withMessage('Cohort name is required.'),
  body('year')
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid year between 2000 and 2100.')
    .toInt(),
  body('startDate').isISO8601().withMessage('Start date must be a valid ISO 8601 date.').toDate(),
  body('endDate').isISO8601().withMessage('End date must be a valid ISO 8601 date.').toDate(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters.'),
];

const updateCohortValidation = [
  body('name').optional().trim().notEmpty().withMessage('Cohort name cannot be empty.'),
  body('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid year between 2000 and 2100.')
    .toInt(),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date.')
    .toDate(),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date.')
    .toDate(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters.'),
];

const listCohortValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100.')
    .toInt(),
  query('status')
    .optional()
    .isIn(['upcoming', 'active', 'completed', 'archived'])
    .withMessage('Status must be one of: upcoming, active, completed, archived.'),
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid year between 2000 and 2100.')
    .toInt(),
];

module.exports = {
  createCohortValidation,
  updateCohortValidation,
  listCohortValidation,
};
