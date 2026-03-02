const { body } = require('express-validator');

const SCALE_TYPES = ['1_to_5', '1_to_10', 'percentage', 'custom'];
const APPLIES_TO = ['team', 'individual', 'both'];

const createKPIValidation = [
  body('name').trim().notEmpty().withMessage('KPI name is required.'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters.'),
  body('weight')
    .isFloat({ min: 0 })
    .withMessage('Weight must be a non-negative number.'),
  body('scaleType')
    .isIn(SCALE_TYPES)
    .withMessage(`Scale type must be one of: ${SCALE_TYPES.join(', ')}.`),
  body('scaleMin').optional().isFloat().withMessage('scaleMin must be a number.'),
  body('scaleMax').optional().isFloat().withMessage('scaleMax must be a number.'),
  body('appliesTo')
    .optional()
    .isIn(APPLIES_TO)
    .withMessage(`appliesTo must be one of: ${APPLIES_TO.join(', ')}.`),
  body('requireComment').optional().isBoolean().withMessage('requireComment must be a boolean.'),
  body('showRecommendation').optional().isBoolean().withMessage('showRecommendation must be a boolean.'),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer.'),
];

const updateKPIValidation = [
  body('name').optional().trim().notEmpty().withMessage('KPI name cannot be empty.'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters.'),
  body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be a non-negative number.'),
  body('scaleType')
    .optional()
    .isIn(SCALE_TYPES)
    .withMessage(`Scale type must be one of: ${SCALE_TYPES.join(', ')}.`),
  body('scaleMin').optional().isFloat().withMessage('scaleMin must be a number.'),
  body('scaleMax').optional().isFloat().withMessage('scaleMax must be a number.'),
  body('appliesTo')
    .optional()
    .isIn(APPLIES_TO)
    .withMessage(`appliesTo must be one of: ${APPLIES_TO.join(', ')}.`),
  body('requireComment').optional().isBoolean().withMessage('requireComment must be a boolean.'),
  body('showRecommendation').optional().isBoolean().withMessage('showRecommendation must be a boolean.'),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer.'),
];

module.exports = { createKPIValidation, updateKPIValidation };
