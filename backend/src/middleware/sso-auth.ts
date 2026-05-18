import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * SSO 统一认证中间件（可选）
 *
 * 验证 Agent SSO JWT Token，将 agent 信息注入 req.user
 * 如果请求不带 Token，不拦截（非阻塞模式）
 *
 * 支持两种 Token：
 * 1. Agent SSO JWT（由 ADC JWT_SECRET_SSO 签发）
 * 2. 平台自身 JWT（由 JWT_SECRET 签发，用于管理后台）
 */
export function ssoOptional(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);

  try {
    // 先尝试 ADC SSO JWT（统一 Agent 认证）
    const payload = jwt.verify(token, env.JWT_SECRET_SSO) as {
      sub: string;
      name: string;
      role: string;
      permissions?: string[];
    };
    req.user = {
      id: payload.sub,
      name: payload.name,
      role: payload.role,
      agentId: payload.sub,
      permissions: payload.permissions ?? [],
    };
    return next();
  } catch {
    // 非 SSO token，继续尝试自身 JWT
  }

  try {
    // 尝试平台自身 JWT（管理员登录）
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    // 保持兼容性，由后续 authRequired 中间件补全 user 信息
    req.authTokenPayload = payload;
  } catch {
    // Token 无效，继续但不注入用户
  }

  next();
}

/**
 * SSO 严格认证（必须带有效 Token）
 */
export function ssoRequired(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    _res.status(401).json({ error: 'Unauthorized', message: '请提供有效的认证 Token' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // 先尝试 ADC SSO JWT
    const payload = jwt.verify(token, env.JWT_SECRET_SSO) as {
      sub: string;
      name: string;
      role: string;
      permissions?: string[];
    };
    req.user = {
      id: payload.sub,
      name: payload.name,
      role: payload.role,
      agentId: payload.sub,
      permissions: payload.permissions ?? [],
    };
    return next();
  } catch {
    // 不是 SSO token，继续检查自身 JWT
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.authTokenPayload = payload;
    return next();
  } catch {
    _res.status(401).json({ error: 'Unauthorized', message: 'Token 无效或已过期' });
    return;
  }
}
