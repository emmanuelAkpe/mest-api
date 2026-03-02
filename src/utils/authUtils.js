const { logger } = require('./logger');
const { env } = require('../config/env');

function logAuthEvent(meta) {
  if (meta.event === 'login_failed') {
    logger.warn('Auth event', meta);
  } else {
    logger.info('Auth event', meta);
  }
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
  });
}

module.exports = { logAuthEvent, setRefreshCookie, clearRefreshCookie };
