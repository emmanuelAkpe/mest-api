const { body } = require('express-validator');

const submitValidation = [
  body('teamScores')
    .isArray({ min: 1 })
    .withMessage('teamScores must be a non-empty array.'),
  body('teamScores.*.team')
    .isMongoId()
    .withMessage('Each team must be a valid ID.'),
  body('teamScores.*.overallComment')
    .trim()
    .notEmpty()
    .withMessage('overallComment is required for each team.'),
  body('teamScores.*.scores')
    .isArray()
    .withMessage('scores must be an array.'),
  body('teamScores.*.scores.*.kpi')
    .isMongoId()
    .withMessage('Each KPI must be a valid ID.'),
  body('teamScores.*.scores.*.score')
    .isFloat()
    .withMessage('Each score must be a number.'),
  body('teamScores.*.scores.*.comment')
    .optional()
    .trim(),
  body('teamScores.*.scores.*.recommendation')
    .optional()
    .trim(),
];

module.exports = { submitValidation };
