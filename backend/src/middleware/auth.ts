import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';
import { asyncHandler } from '../utils/async-handler.js';

interface TokenPayload {
  sub: string;
}

export function signAccessToken(user: Express.AuthUser): string {
  return jwt.sign({ sub: user.id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(user: Express.AuthUser): string {
  return jwt.sign({ sub: user.id }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

export const authRequired = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;

  if (!token) {
    throw new HttpError(401, '请先登录');
  }

  // 如果已通过 SSO 中间件注入用户信息，直接放行
  if (req.user && req.user.agentId) {
    return next();
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    throw new HttpError(401, '登录状态已失效');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true, avatar: true, status: true },
  });

  if (!user || user.status === 'disabled') {
    throw new HttpError(401, '用户不存在或已被禁用');
  }

  req.user = user;
  next();
});

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new HttpError(401, '请先登录'));
    }
    if (!roles.includes(req.user.role as UserRole)) {
      return next(new HttpError(403, '当前角色无权执行此操作'));
    }
    return next();
  };
}
