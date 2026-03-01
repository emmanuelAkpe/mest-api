import { Router } from 'express';
import { body } from 'express-validator';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { register, login, refresh, logout, getMe } from '../controllers/auth.controller';

const router = Router();

router.use(authLimiter);

router.post(
  '/register',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
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
  register
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

router.post('/refresh', refresh);

router.post('/logout', authenticate, logout);

router.get('/me', authenticate, getMe);

export default router;
