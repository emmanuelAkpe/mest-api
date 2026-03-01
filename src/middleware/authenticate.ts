import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokenUtils';
import { sendError, ERROR_CODES } from '../utils/response';
import Admin from '../models/Admin.model';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
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
