const { Router } = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { invite, onboard, login, refresh, logout, getMe, forgotPassword, resetPassword, changePassword, resendInvite } = require('../controllers/auth.controller');
const { inviteValidation, onboardValidation, loginValidation, forgotPasswordValidation, resetPasswordValidation, changePasswordValidation, resendInviteValidation } = require('../validators/auth.validators');

const router = Router();

router.use(authLimiter);

router.post('/invite', authenticate, requireRole('super_admin'), inviteValidation, validate, invite);
router.post('/onboard', onboardValidation, validate, onboard);
router.post('/login', loginValidation, validate, login);
router.post('/forgot-password', forgotPasswordValidation, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidation, validate, resetPassword);
router.post('/change-password', authenticate, changePasswordValidation, validate, changePassword);
router.post('/resend-invite', authenticate, requireRole('super_admin'), resendInviteValidation, validate, resendInvite);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

module.exports = router;
