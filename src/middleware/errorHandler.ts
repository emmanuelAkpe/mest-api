import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendError, ERROR_CODES } from '../utils/response';

export function errorHandler(
  err: Error & { status?: number; code?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
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
