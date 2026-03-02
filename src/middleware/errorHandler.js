const { logger } = require('../utils/logger');
const { sendError, ERROR_CODES } = require('../utils/response');

function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.code === 11000) {
    sendError(res, 409, {
      code: ERROR_CODES.DUPLICATE_ENTRY,
      message: 'A record with that value already exists.',
    });
    return;
  }

  const status = err.status ?? 500;
  sendError(res, status, {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'An unexpected error occurred.',
  });
}

module.exports = { errorHandler };
