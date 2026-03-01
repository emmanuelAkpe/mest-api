import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { sendError, ERROR_CODES } from '../utils/response';

export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendError(res, 422, {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed.',
      details: errors.array().map((e) => ({ field: e.type === 'field' ? e.path : e.type, message: e.msg })),
    });
    return;
  }
  next();
}
