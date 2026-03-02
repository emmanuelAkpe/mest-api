const { body, query } = require('express-validator');

const ROLES = ['team_lead', 'cto', 'product', 'business', 'design', 'marketing', 'finance', 'data_ai', 'presenter'];
const PIVOT_TYPES = ['product_idea', 'target_market', 'business_model', 'technical_approach', 'multiple'];

const memberValidation = [
  body('members').optional().isArray().withMessage('Members must be an array.'),
  body('members.*.trainee').isMongoId().withMessage('Each member must have a valid trainee ID.'),
  body('members.*.roles')
    .optional()
    .isArray()
    .withMessage('Roles must be an array.')
    .custom((roles) => {
      if (!roles.every((r) => ROLES.includes(r))) {
        throw new Error(`Each role must be one of: ${ROLES.join(', ')}.`);
      }
      return true;
    }),
];

const createTeamValidation = [
  body('name').trim().notEmpty().withMessage('Team name is required.'),
  body('productIdea')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Product idea must not exceed 500 characters.'),
  body('marketFocus')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Market focus must not exceed 500 characters.'),
  body('parentTeam').optional().isMongoId().withMessage('parentTeam must be a valid ID.'),
  ...memberValidation,
];

const updateTeamValidation = [
  body('name').optional().trim().notEmpty().withMessage('Team name cannot be empty.'),
  body('productIdea')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Product idea must not exceed 500 characters.'),
  body('marketFocus')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Market focus must not exceed 500 characters.'),
  body('parentTeam').optional().isMongoId().withMessage('parentTeam must be a valid ID.'),
  ...memberValidation,
];

const logPivotValidation = [
  body('type')
    .isIn(PIVOT_TYPES)
    .withMessage(`Pivot type must be one of: ${PIVOT_TYPES.join(', ')}.`),
  body('description').trim().notEmpty().withMessage('Description is required.'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Reason must not exceed 1000 characters.'),
  body('wasProactive').optional().isBoolean().withMessage('wasProactive must be a boolean.'),
];

const listTeamsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100.')
    .toInt(),
];

module.exports = { createTeamValidation, updateTeamValidation, logPivotValidation, listTeamsValidation };
