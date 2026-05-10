import type { Request } from 'express';

declare global {
  namespace Express {
    // 修复 Express 5 ParamsDictionary 类型
    interface Request {
      user?: AuthUser;
      requestId: string;
    }

    interface AuthUser {
      id: string;
      name: string;
      email: string;
      role: 'admin' | 'publisher' | 'user';
      avatar?: string | null;
      status?: string;
    }
  }
}

// 修复 Express 5 req.params 类型
declare module 'express' {
  interface ParamsDictionary {
    [key: string]: string;
  }
}
