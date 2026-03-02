const { body } = require('express-validator');

const passwordField = (field = 'password') =>
  body(field).isLength({ min: 6 }).withMessage(
    field === 'password' ? 'Password must be at least 6 characters.' : 'New password must be at least 6 characters.'
  );

const emailField = (field = 'email') =>
  body(field).isEmail().normalizeEmail().withMessage('Valid email is required.');

const inviteValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required.'),
  body('lastName').trim().notEmpty().withMessage('Last name is required.'),
  emailField(),
  body('role')
    .optional()
    .isIn(['super_admin', 'program_admin'])
    .withMessage('Role must be super_admin or program_admin.'),
];

const onboardValidation = [
  emailField(),
  body('token').notEmpty().withMessage('Invite token is required.'),
  passwordField(),
];

const loginValidation = [
  emailField(),
  body('password').notEmpty().withMessage('Password is required.'),
];

const forgotPasswordValidation = [emailField()];

const resetPasswordValidation = [
  emailField(),
  body('token').notEmpty().withMessage('Reset token is required.'),
  passwordField(),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  passwordField('newPassword'),
];

const resendInviteValidation = [emailField()];

module.exports = {
  inviteValidation,
  onboardValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  resendInviteValidation,
};
