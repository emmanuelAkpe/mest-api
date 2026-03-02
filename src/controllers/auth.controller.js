const crypto = require('crypto');
const Admin = require('../models/Admin.model');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken, compareToken } = require('../utils/tokenUtils');
const { sendSuccess, sendError, ERROR_CODES } = require('../utils/response');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');
const { sendInviteEmail, sendPasswordResetEmail } = require('../services/email.service');
const { getIp, getUserAgent } = require('../utils/request');
const { logAuthEvent, setRefreshCookie, clearRefreshCookie } = require('../utils/authUtils');

const INVITE_EXPIRY_MS = 72 * 60 * 60 * 1000; // 72 hours
const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const MAX_REFRESH_TOKENS = 5;

async function issueTokens(admin, res) {
  const accessToken = signAccessToken({ id: admin.id, email: admin.email, role: admin.role });
  const refreshToken = signRefreshToken({ id: admin.id });
  const hashedRefresh = await hashToken(refreshToken);

  admin.refreshTokens.push(hashedRefresh);
  if (admin.refreshTokens.length > MAX_REFRESH_TOKENS) {
    admin.refreshTokens = admin.refreshTokens.slice(-MAX_REFRESH_TOKENS);
  }

  await admin.save();
  setRefreshCookie(res, refreshToken);
  return { accessToken, refreshToken };
}

async function invite(req, res, next) {
  try {
    const { firstName, lastName, email, role } = req.body;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await hashToken(rawToken);
    const expiry = new Date(Date.now() + INVITE_EXPIRY_MS);

    const admin = await Admin.create({
      firstName,
      lastName,
      email,
      ...(role && { role }),
      inviteToken: hashedToken,
      inviteTokenExpiry: expiry,
    });

    const inviteUrl = `${env.FRONTEND_URL}/onboard?token=${rawToken}&email=${encodeURIComponent(email)}`;
    await sendInviteEmail({ to: email, firstName, inviteUrl });

    logAuthEvent({
      event: 'invite_sent',
      adminId: admin.id,
      email: admin.email,
      invitedBy: req.admin.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });

    sendSuccess(res, 201, {
      data: { id: admin.id, firstName: admin.firstName, lastName: admin.lastName, email: admin.email, role: admin.role },
      message: 'Invitation sent successfully.',
    });
  } catch (err) {
    if (err?.code === 11000) {
      sendError(res, 409, { code: ERROR_CODES.DUPLICATE_ENTRY, message: 'Email already in use.' });
      return;
    }
    next(err);
  }
}

async function onboard(req, res, next) {
  try {
    const { token, email, password } = req.body;

    const admin = await Admin
      .findOne({ email: email.toLowerCase() })
      .select('+password +inviteToken +inviteTokenExpiry');

    if (!admin || !admin.inviteToken) {
      sendError(res, 400, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired invitation.' });
      return;
    }

    if (admin.isActive) {
      sendError(res, 400, { code: ERROR_CODES.UNAUTHORIZED, message: 'Account is already active.' });
      return;
    }

    if (admin.inviteTokenExpiry < new Date()) {
      sendError(res, 400, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invitation link has expired.' });
      return;
    }

    const tokenMatch = await compareToken(token, admin.inviteToken);
    if (!tokenMatch) {
      sendError(res, 400, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired invitation.' });
      return;
    }

    admin.password = password;
    admin.isActive = true;
    admin.inviteToken = undefined;
    admin.inviteTokenExpiry = undefined;
    await admin.save();

    const tokens = await issueTokens(admin, res);

    logAuthEvent({ event: 'onboard_complete', adminId: admin.id, email: admin.email, ip: getIp(req), userAgent: getUserAgent(req) });

    sendSuccess(res, 200, {
      data: { accessToken: tokens.accessToken },
      message: 'Account set up successfully.',
      meta: { adminId: admin.id, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const INVALID_MSG = 'Invalid email or password.';

    const admin = await Admin.findByEmail(email);

    if (!admin || !admin.isActive) {
      logAuthEvent({ event: 'login_failed', adminId: null, email, ip: getIp(req), userAgent: getUserAgent(req), reason: 'not_found_or_inactive' });
      sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: INVALID_MSG });
      return;
    }

    const passwordMatch = await admin.comparePassword(password);
    if (!passwordMatch) {
      logAuthEvent({ event: 'login_failed', adminId: admin.id, email, ip: getIp(req), userAgent: getUserAgent(req), reason: 'wrong_password' });
      sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: INVALID_MSG });
      return;
    }

    admin.lastLogin = new Date();
    const tokens = await issueTokens(admin, res);

    logAuthEvent({ event: 'login_success', adminId: admin.id, email, ip: getIp(req), userAgent: getUserAgent(req) });

    sendSuccess(res, 200, {
      data: { accessToken: tokens.accessToken },
      message: 'Login successful.',
      meta: { adminId: admin.id, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
      return;
    }

    const payload = verifyRefreshToken(rawToken);
    const admin = await Admin.findById(payload.id);

    if (!admin || !admin.isActive) {
      sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
      return;
    }

    let matchIndex = -1;
    for (let i = 0; i < admin.refreshTokens.length; i++) {
      const match = await compareToken(rawToken, admin.refreshTokens[i]);
      if (match) { matchIndex = i; break; }
    }

    if (matchIndex === -1) {
      logger.warn('Auth event', {
        event: 'token_refresh',
        adminId: admin.id,
        email: admin.email,
        ip: getIp(req),
        userAgent: getUserAgent(req),
        reason: 'token_not_found_possible_theft',
      });
      admin.refreshTokens = [];
      await admin.save();
      sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
      return;
    }

    admin.refreshTokens.splice(matchIndex, 1);
    const tokens = await issueTokens(admin, res);

    logAuthEvent({ event: 'token_refresh', adminId: admin.id, email: admin.email, ip: getIp(req), userAgent: getUserAgent(req) });

    sendSuccess(res, 200, {
      data: { accessToken: tokens.accessToken },
      message: 'Token refreshed.',
    });
  } catch (err) {
    sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
  }
}

async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken;

    if (rawToken) {
      const fullAdmin = await Admin.findById(req.admin.id);
      if (fullAdmin) {
        let matchIndex = -1;
        for (let i = 0; i < fullAdmin.refreshTokens.length; i++) {
          const match = await compareToken(rawToken, fullAdmin.refreshTokens[i]);
          if (match) { matchIndex = i; break; }
        }
        if (matchIndex !== -1) fullAdmin.refreshTokens.splice(matchIndex, 1);
        await fullAdmin.save();
      }
    }

    clearRefreshCookie(res);
    logAuthEvent({ event: 'logout', adminId: req.admin.id, email: req.admin.email, ip: getIp(req), userAgent: getUserAgent(req) });

    sendSuccess(res, 200, { message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const GENERIC_MSG = 'If that email is registered, a reset link has been sent.';

    const admin = await Admin.findOne({ email: email.toLowerCase(), isActive: true });

    if (!admin) {
      // Always respond the same way to avoid user enumeration
      sendSuccess(res, 200, { message: GENERIC_MSG });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await hashToken(rawToken);

    admin.passwordResetToken = hashedToken;
    admin.passwordResetExpiry = new Date(Date.now() + RESET_EXPIRY_MS);
    await admin.save();

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(admin.email)}`;
    await sendPasswordResetEmail({ to: admin.email, firstName: admin.firstName, resetUrl });

    logAuthEvent({ event: 'password_reset_requested', adminId: admin.id, email: admin.email, ip: getIp(req), userAgent: getUserAgent(req) });

    sendSuccess(res, 200, { message: GENERIC_MSG });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { email, token, password } = req.body;

    const admin = await Admin
      .findOne({ email: email.toLowerCase(), isActive: true })
      .select('+password +passwordResetToken +passwordResetExpiry');

    if (!admin || !admin.passwordResetToken) {
      sendError(res, 400, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired reset link.' });
      return;
    }

    if (admin.passwordResetExpiry < new Date()) {
      sendError(res, 400, { code: ERROR_CODES.UNAUTHORIZED, message: 'Reset link has expired.' });
      return;
    }

    const tokenMatch = await compareToken(token, admin.passwordResetToken);
    if (!tokenMatch) {
      sendError(res, 400, { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid or expired reset link.' });
      return;
    }

    admin.password = password;
    admin.passwordResetToken = undefined;
    admin.passwordResetExpiry = undefined;
    admin.refreshTokens = []; // invalidate all active sessions
    await admin.save();

    clearRefreshCookie(res);
    logAuthEvent({ event: 'password_reset_complete', adminId: admin.id, email: admin.email, ip: getIp(req), userAgent: getUserAgent(req) });

    sendSuccess(res, 200, { message: 'Password reset successfully. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const admin = await Admin.findById(req.admin.id).select('+password');

    const passwordMatch = await admin.comparePassword(currentPassword);
    if (!passwordMatch) {
      sendError(res, 400, { code: ERROR_CODES.UNAUTHORIZED, message: 'Current password is incorrect.' });
      return;
    }

    admin.password = newPassword;
    admin.refreshTokens = []; // invalidate all sessions
    await admin.save();

    clearRefreshCookie(res);
    logAuthEvent({ event: 'password_changed', adminId: admin.id, email: admin.email, ip: getIp(req), userAgent: getUserAgent(req) });

    sendSuccess(res, 200, { message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

async function resendInvite(req, res, next) {
  try {
    const { email } = req.body;

    const admin = await Admin
      .findOne({ email: email.toLowerCase(), isActive: false })
      .select('+inviteToken +inviteTokenExpiry');

    if (!admin) {
      sendError(res, 404, { code: ERROR_CODES.NOT_FOUND, message: 'No pending invitation found for this email.' });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await hashToken(rawToken);

    admin.inviteToken = hashedToken;
    admin.inviteTokenExpiry = new Date(Date.now() + INVITE_EXPIRY_MS);
    await admin.save();

    const inviteUrl = `${env.FRONTEND_URL}/onboard?token=${rawToken}&email=${encodeURIComponent(admin.email)}`;
    await sendInviteEmail({ to: admin.email, firstName: admin.firstName, inviteUrl });

    logAuthEvent({ event: 'invite_resent', adminId: admin.id, email: admin.email, resentBy: req.admin.id, ip: getIp(req), userAgent: getUserAgent(req) });

    sendSuccess(res, 200, { message: 'Invitation resent successfully.' });
  } catch (err) {
    next(err);
  }
}

function getMe(req, res) {
  const { id, firstName, lastName, email, role, lastLogin, createdAt } = req.admin;
  sendSuccess(res, 200, {
    data: { id, firstName, lastName, email, role, lastLogin, createdAt },
  });
}

module.exports = { invite, onboard, login, refresh, logout, getMe, forgotPassword, resetPassword, changePassword, resendInvite };
