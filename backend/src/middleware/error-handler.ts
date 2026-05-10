import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: '请求参数校验失败',
      errors: error.flatten(),
      requestId: req.requestId,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
      requestId: req.requestId,
    });
  }

  console.error(`[${req.requestId}] Unhandled error`, error);

  return res.status(500).json({
    message: '服务器内部错误',
    requestId: req.requestId,
    stack: env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
  });
};
