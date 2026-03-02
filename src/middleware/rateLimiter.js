const rateLimit = require('express-rate-limit');
const { sendError, ERROR_CODES } = require('../utils/response');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many requests, please try again later.',
    });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many auth requests, please try again later.',
    });
  },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many requests, please slow down.',
    });
  },
});

module.exports = { globalLimiter, authLimiter, apiLimiter };
