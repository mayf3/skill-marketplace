# Skill Marketplace — 技术栈声明

> 本文档声明项目使用的技术栈，**禁止混用其他技术栈**。

## 后端 (backend/)

| 层级 | 技术 | 版本 |
|------|------|------|
| Runtime | Node.js | v20+ |
| 语言 | TypeScript | strict mode |
| 框架 | Express | 4.x |
| ORM | Prisma | 6.x |
| 数据库 | PostgreSQL | 15+ |
| 缓存 | Redis (ioredis) | — |
| 认证 | JWT (jsonwebtoken) + bcrypt | — |
| 校验 | Zod | 3.x |
| 限流 | express-rate-limit | — |

## 基础设施

- **部署**: Docker
- **端口**: 4001
- **SSO**: 接入 ADC 统一 Agent SSO

## ❌ 禁止引入

- Python / Go 等其他语言后端
- MongoDB / MySQL 等其他数据库
- GraphQL（REST API 优先）
