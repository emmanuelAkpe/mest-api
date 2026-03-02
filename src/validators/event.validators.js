const { body, query } = require('express-validator');

const EVENT_TYPES = ['startup_build', 'newco', 'class_workshop', 'internal_review', 'demo_pitch_day', 'other'];
const EVENT_STATUSES = ['not_started', 'in_progress', 'completed'];

const createEventValidation = [
  body('name').trim().notEmpty().withMessage('Event name is required.'),
  body('type')
    .isIn(EVENT_TYPES)
    .withMessage(`Event type must be one of: ${EVENT_TYPES.join(', ')}.`),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters.'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date.').toDate(),
  body('endDate').isISO8601().withMessage('End date must be a valid date.').toDate(),
];

const updateEventValidation = [
  body('name').optional().trim().notEmpty().withMessage('Event name cannot be empty.'),
  body('type')
    .optional()
    .isIn(EVENT_TYPES)
    .withMessage(`Event type must be one of: ${EVENT_TYPES.join(', ')}.`),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters.'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date.').toDate(),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date.').toDate(),
];

const listEventsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100.')
    .toInt(),
  query('type')
    .optional()
    .isIn(EVENT_TYPES)
    .withMessage(`Type must be one of: ${EVENT_TYPES.join(', ')}.`),
  query('status')
    .optional()
    .isIn(EVENT_STATUSES)
    .withMessage(`Status must be one of: ${EVENT_STATUSES.join(', ')}.`),
];

module.exports = { createEventValidation, updateEventValidation, listEventsValidation };
