const { Router } = require('express');
const { body } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { invite, onboard, login, refresh, logout, getMe, forgotPassword, resetPassword } = require('../controllers/auth.controller');

const router = Router();

router.use(authLimiter);

router.post(
  '/invite',
  authenticate,
  requireRole('super_admin'),
  [
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('role')
      .optional()
      .isIn(['super_admin', 'program_admin'])
      .withMessage('Role must be super_admin or program_admin.'),
  ],
  validate,
  invite
);

router.post(
  '/onboard',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('token').notEmpty().withMessage('Invite token is required.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number.')
      .matches(/[^A-Za-z0-9]/)
      .withMessage('Password must contain at least one special character.'),
  ],
  validate,
  onboard
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  login
);

router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required.')],
  validate,
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('token').notEmpty().withMessage('Reset token is required.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number.')
      .matches(/[^A-Za-z0-9]/)
      .withMessage('Password must contain at least one special character.'),
  ],
  validate,
  resetPassword
);

router.post('/refresh', refresh);

router.post('/logout', authenticate, logout);

router.get('/me', authenticate, getMe);

module.exports = router;
