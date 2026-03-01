import { Response } from 'express';
import Admin, { IAdmin } from '../models/Admin.model';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  compareToken,
} from '../utils/tokenUtils';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const MAX_REFRESH_TOKENS = 5;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthLogMeta {
  event: 'login_success' | 'login_failed' | 'register' | 'logout' | 'token_refresh' | 'logout_all';
  adminId: string | null;
  email: string;
  ip: string;
  userAgent: string;
  reason?: string;
}

export function logAuthEvent(meta: AuthLogMeta): void {
  if (meta.event === 'login_failed') {
    logger.warn('Auth event', meta);
  } else {
    logger.info('Auth event', meta);
  }
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
  });
}

async function issueTokens(admin: IAdmin, res: Response): Promise<AuthTokens> {
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

export async function registerAdmin(
  data: { firstName: string; lastName: string; email: string; password: string },
  res: Response,
  ip: string,
  userAgent: string
): Promise<{ admin: IAdmin; tokens: AuthTokens }> {
  const admin = await Admin.create(data);
  const tokens = await issueTokens(admin, res);

  logAuthEvent({ event: 'register', adminId: admin.id, email: admin.email, ip, userAgent });
  return { admin, tokens };
}

export async function loginAdmin(
  email: string,
  password: string,
  res: Response,
  ip: string,
  userAgent: string
): Promise<{ admin: IAdmin; tokens: AuthTokens }> {
  const INVALID_MSG = 'Invalid email or password.';

  const admin = await (Admin as any).findByEmail(email) as IAdmin | null;

  if (!admin || !admin.isActive) {
    logAuthEvent({ event: 'login_failed', adminId: null, email, ip, userAgent, reason: 'not_found_or_inactive' });
    throw Object.assign(new Error(INVALID_MSG), { status: 401, publicMessage: INVALID_MSG });
  }

  const passwordMatch = await admin.comparePassword(password);
  if (!passwordMatch) {
    logAuthEvent({ event: 'login_failed', adminId: admin.id, email, ip, userAgent, reason: 'wrong_password' });
    throw Object.assign(new Error(INVALID_MSG), { status: 401, publicMessage: INVALID_MSG });
  }

  admin.lastLogin = new Date();
  const tokens = await issueTokens(admin, res);

  logAuthEvent({ event: 'login_success', adminId: admin.id, email, ip, userAgent });
  return { admin, tokens };
}

export async function refreshTokens(
  rawToken: string,
  res: Response,
  ip: string,
  userAgent: string
): Promise<{ admin: IAdmin; tokens: AuthTokens }> {
  const payload = verifyRefreshToken(rawToken);

  const admin = await Admin.findById(payload.id);
  if (!admin || !admin.isActive) {
    throw Object.assign(new Error('Authentication required.'), { status: 401 });
  }

  // Find the matching hashed token
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
      ip,
      userAgent,
      reason: 'token_not_found_possible_theft',
    });
    // Invalidate all tokens as a precaution
    admin.refreshTokens = [];
    await admin.save();
    throw Object.assign(new Error('Authentication required.'), { status: 401 });
  }

  // Rotate: remove old token
  admin.refreshTokens.splice(matchIndex, 1);
  const tokens = await issueTokens(admin, res);

  logAuthEvent({ event: 'token_refresh', adminId: admin.id, email: admin.email, ip, userAgent });
  return { admin, tokens };
}

export async function logoutAdmin(
  admin: IAdmin,
  rawToken: string | undefined,
  res: Response,
  ip: string,
  userAgent: string
): Promise<void> {
  if (rawToken) {
    const fullAdmin = await Admin.findById(admin.id);
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
  logAuthEvent({ event: 'logout', adminId: admin.id, email: admin.email, ip, userAgent });
}
