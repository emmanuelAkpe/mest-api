const { body, query } = require('express-validator');

const SKILL_LEVELS = ['none', 'basic', 'intermediate', 'advanced'];

const skillLevelField = (field) =>
  body(field)
    .optional()
    .isIn(SKILL_LEVELS)
    .withMessage(`${field} must be one of: ${SKILL_LEVELS.join(', ')}.`);

const urlField = (field) =>
  body(field)
    .optional()
    .isURL()
    .withMessage(`${field} must be a valid URL.`);

const createTraineeValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required.'),
  body('lastName').trim().notEmpty().withMessage('Last name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('country').trim().notEmpty().withMessage('Country is required.'),
  urlField('photo'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio must not exceed 1000 characters.'),
  skillLevelField('technicalBackground'),
  skillLevelField('aiSkillLevel'),
  urlField('linkedIn'),
  urlField('github'),
  urlField('portfolio'),
  body('entryScore')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Entry score must be between 0 and 100.'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters.'),
];

const updateTraineeValidation = [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty.'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty.'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('country').optional().trim().notEmpty().withMessage('Country cannot be empty.'),
  urlField('photo'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio must not exceed 1000 characters.'),
  skillLevelField('technicalBackground'),
  skillLevelField('aiSkillLevel'),
  urlField('linkedIn'),
  urlField('github'),
  urlField('portfolio'),
  body('entryScore')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Entry score must be between 0 and 100.'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters.'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.'),
];

const listTraineesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100.')
    .toInt(),
  query('search').optional().trim(),
  query('country').optional().trim(),
];

module.exports = { createTraineeValidation, updateTraineeValidation, listTraineesValidation };
