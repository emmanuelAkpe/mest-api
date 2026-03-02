const { verifyAccessToken } = require('../utils/tokenUtils');
const { sendError, ERROR_CODES } = require('../utils/response');
const Admin = require('../models/Admin.model');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    const admin = await Admin.findById(payload.id).select('+passwordChangedAt');
    if (!admin || !admin.isActive) {
      sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
      return;
    }

    if (admin.isTokenIssuedBeforePasswordChange(payload.iat)) {
      sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
      return;
    }

    req.admin = admin;
    next();
  } catch {
    sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      sendError(res, 403, { code: ERROR_CODES.FORBIDDEN, message: 'Insufficient permissions.' });
      return;
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
