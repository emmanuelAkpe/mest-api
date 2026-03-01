import { Response } from 'express';

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

interface SuccessPayload {
  data?: unknown;
  message?: string;
  meta?: unknown;
}

interface ErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown[];
}

export function sendSuccess(res: Response, status: number, payload: SuccessPayload): Response {
  return res.status(status).json({
    success: true,
    data: payload.data ?? {},
    message: payload.message ?? '',
    meta: payload.meta ?? {},
  });
}

export function sendError(res: Response, status: number, payload: ErrorPayload): Response {
  return res.status(status).json({
    success: false,
    error: {
      code: payload.code,
      message: payload.message,
      details: payload.details ?? [],
    },
  });
}
