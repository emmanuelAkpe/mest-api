import { Request, Response, NextFunction } from 'express';
import {
  registerAdmin,
  loginAdmin,
  refreshTokens,
  logoutAdmin,
} from '../services/auth.service';
import { sendSuccess, sendError, ERROR_CODES } from '../utils/response';

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
}

function getUserAgent(req: Request): string {
  return req.headers['user-agent'] ?? 'unknown';
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { firstName, lastName, email, password } = req.body;
    const { admin, tokens } = await registerAdmin(
      { firstName, lastName, email, password },
      res,
      getIp(req),
      getUserAgent(req)
    );

    sendSuccess(res, 201, {
      data: { accessToken: tokens.accessToken },
      message: 'Admin registered successfully.',
      meta: { adminId: admin.id, role: admin.role },
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      sendError(res, 409, { code: ERROR_CODES.DUPLICATE_ENTRY, message: 'Email already in use.' });
      return;
    }
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const { admin, tokens } = await loginAdmin(email, password, res, getIp(req), getUserAgent(req));

    sendSuccess(res, 200, {
      data: { accessToken: tokens.accessToken },
      message: 'Login successful.',
      meta: { adminId: admin.id, role: admin.role },
    });
  } catch (err: any) {
    if (err?.publicMessage) {
      sendError(res, err.status ?? 401, { code: ERROR_CODES.UNAUTHORIZED, message: err.publicMessage });
      return;
    }
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken: string | undefined = req.cookies?.refreshToken;
    if (!rawToken) {
      sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
      return;
    }

    const { tokens } = await refreshTokens(rawToken, res, getIp(req), getUserAgent(req));

    sendSuccess(res, 200, {
      data: { accessToken: tokens.accessToken },
      message: 'Token refreshed.',
    });
  } catch (err: any) {
    if (err?.status === 401) {
      sendError(res, 401, { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
      return;
    }
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken: string | undefined = req.cookies?.refreshToken;
    await logoutAdmin(req.admin!, rawToken, res, getIp(req), getUserAgent(req));
    sendSuccess(res, 200, { message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

export function getMe(req: Request, res: Response): void {
  const { id, firstName, lastName, email, role, lastLogin, createdAt } = req.admin!;
  sendSuccess(res, 200, {
    data: { id, firstName, lastName, email, role, lastLogin, createdAt },
  });
}
