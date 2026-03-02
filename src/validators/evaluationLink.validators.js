const { body } = require('express-validator');

const createLinkValidation = [
  body('evaluatorName').trim().notEmpty().withMessage('Evaluator name is required.'),
  body('evaluatorEmail')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail(),
  body('teams')
    .isArray({ min: 1 })
    .withMessage('At least one team is required.'),
  body('teams.*')
    .isMongoId()
    .withMessage('Each team must be a valid ID.'),
  body('expiresAt')
    .isISO8601()
    .withMessage('expiresAt must be a valid ISO 8601 date.')
    .toDate(),
];

module.exports = { createLinkValidation };
