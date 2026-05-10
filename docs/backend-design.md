# Skill Marketplace 后端技术设计文档

> 作者：后端开发工程师 | 日期：2026-05-10 | 版本：v1.0

---

## 1. 项目概述

构建内部技能商城后端服务，提供技能的发布、浏览、搜索、申请、审核和管理等功能。

### 1.1 技术栈

| 组件 | 选型 | 版本 |
|------|------|------|
| 运行时 | Node.js | >= 20 |
| 框架 | Express + TypeScript | ^5 |
| 数据库 | PostgreSQL | 16 |
| 缓存 | Redis | 7 |
| ORM | Prisma | ^5 |
| 认证 | JWT (Bearer Token) | — |
| 校验 | Zod | ^3 |
| 测试 | Vitest | ^3 |

### 1.2 基础约束

- 端口：**4001**
- 项目目录：`~/workspace/project/skill-marketplace`
- 复用 agent-dev-center 的认证体系（JWT），独立数据库

---

## 2. 目录结构

```
skill-marketplace/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts            # 环境变量校验
│   │   ├── lib/
│   │   │   ├── prisma.ts         # Prisma Client 单例
│   │   │   └── redis.ts          # Redis Client 单例
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT 认证 + 角色守卫
│   │   │   ├── error-handler.ts  # 全局错误处理
│   │   │   └── rate-limit.ts     # 速率限制
│   │   ├── routes/
│   │   │   ├── auth.ts           # 登录/注册/refresh
│   │   │   ├── skills.ts         # 技能 CRUD + 发布
│   │   │   ├── categories.ts     # 分类管理
│   │   │   ├── applications.ts   # 技能申请
│   │   │   ├── reviews.ts        # 审核流程
│   │   │   ├── search.ts         # 搜索 + 筛选
│   │   │   └── admin.ts          # 管理后台
│   │   ├── schemas/
│   │   │   ├── auth.ts
│   │   │   ├── skill.ts
│   │   │   ├── category.ts
│   │   │   ├── application.ts
│   │   │   └── review.ts
│   │   ├── services/
│   │   │   ├── skill.service.ts
│   │   │   ├── search.service.ts
│   │   │   └── notification.service.ts
│   │   ├── utils/
│   │   │   ├── async-handler.ts
│   │   │   ├── http-error.ts
│   │   │   ├── pagination.ts
│   │   │   └── status.ts
│   │   ├── types/
│   │   │   └── express.d.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
├── docs/
│   └── backend-design.md         # 本文档
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## 3. 数据库设计 (ER)

### 3.1 ER 关系图

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  users   │     │  categories  │     │   skills     │
├──────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)  │◄────┤ id (PK)      │◄────┤ id (PK)      │
│ name     │     │ name         │     │ name         │
│ email    │     │ slug         │     │ slug         │
│ password │     │ description  │     │ version      │
│ role     │     │ icon         │     │ description  │
│ avatar   │     │ sort_order   │     │ readme       │
│ status   │     │ parent_id(FK)│     │ author_id(FK)│──► users
│ created  │     │ created      │     │ category_id  │──► categories
│ updated  │     │ updated      │     │ tags         │
└──────────┘     └──────────────┘     │ homepage_url │
      │                               │ repo_url     │
      │                               │ logo_url     │
      │                               │ screenshots  │
      │                               │ status       │
      │                               │ downloads    │
      │                               │ rating       │
      │                               │ visibility   │
      │                               │ created      │
      │                               │ updated      │
      │                               └──────┬───────┘
      │                                      │
      │          ┌───────────────────────────┤
      │          │                           │
      │   ┌──────▼───────┐          ┌───────▼───────┐
      │   │  skill_files  │          │  applications  │
      │   ├──────────────┤          ├───────────────┤
      │   │ id (PK)      │          │ id (PK)       │
      │   │ skill_id (FK)│          │ skill_id (FK) │──► skills
      │   │ file_type    │          │ applicant_id  │──► users
      │   │ file_url     │          │ status        │
      │   │ size         │          │ reason        │
      │   │ checksum     │          │ reviewed_by   │──► users
      │   │ created      │          │ review_note   │
      │   └──────────────┘          │ created       │
      │                             │ updated       │
      │                             └───────────────┘      ┌──────────────┐
      │                                                    │  reviews      │
      │                                                    ├──────────────┤
      └────────────────────────────────────────────────────►│ id (PK)      │
                                                           │ skill_id (FK)│──► skills
                                                           │ user_id (FK) │──► users
                                                           │ rating       │
                                                           │ comment      │
                                                           │ created      │
                                                           └──────────────┘
```

### 3.2 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ========== 枚举 ==========

enum UserRole {
  admin
  publisher    // 技能发布者
  user         // 普通用户
}

enum UserStatus {
  active
  disabled
}

enum SkillStatus {
  draft          // 草稿
  pending_review // 待审核
  approved       // 已通过
  rejected       // 已拒绝
  published      // 已发布
  archived       // 已归档
}

enum SkillVisibility {
  public
  internal       // 仅内部可见
}

enum ApplicationStatus {
  pending      // 待审批
  approved     // 已通过
  rejected     // 已拒绝
}

enum FileType {
  source_code
  icon
  screenshot
  document
}

// ========== 模型 ==========

model User {
  id           String       @id @default(uuid()) @db.Uuid
  name         String
  email        String       @unique
  password     String
  role         UserRole     @default(user)
  avatar       String?
  status       UserStatus   @default(active)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  skills       Skill[]
  applications Application[]
  reviews      Review[]

  @@map("users")
}

model Category {
  id          String     @id @default(uuid()) @db.Uuid
  name        String     @unique
  slug        String     @unique
  description String?
  icon        String?
  sortOrder   Int        @default(0)
  parentId    String?    @db.Uuid
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  skills      Skill[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@map("categories")
}

model Skill {
  id           String           @id @default(uuid()) @db.Uuid
  name         String
  slug         String           @unique
  version      String           @default("1.0.0")
  description  String
  readme       String?          @db.Text
  authorId     String           @db.Uuid
  author       User             @relation(fields: [authorId], references: [id])
  categoryId   String           @db.Uuid
  category     Category         @relation(fields: [categoryId], references: [id])
  tags         String[]         @default([])
  homepageUrl  String?
  repoUrl      String?
  logoUrl      String?
  screenshots  String[]         @default([])
  status       SkillStatus      @default(draft)
  visibility   SkillVisibility  @default(public)
  downloads    Int              @default(0)
  rating       Decimal          @default(0) @db.Decimal(3, 2)
  reviewCount  Int              @default(0)
  publishedAt  DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  files        SkillFile[]
  applications Application[]
  reviews      Review[]

  @@index([status])
  @@index([categoryId])
  @@index([authorId])
  @@index([slug])
  @@map("skills")
}

model SkillFile {
  id        String   @id @default(uuid()) @db.Uuid
  skillId   String   @db.Uuid
  skill     Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)
  fileType  FileType
  fileUrl   String
  fileName  String
  fileSize  Int
  checksum  String?
  createdAt DateTime @default(now())

  @@index([skillId])
  @@map("skill_files")
}

model Application {
  id          String             @id @default(uuid()) @db.Uuid
  skillId     String             @db.Uuid
  skill       Skill              @relation(fields: [skillId], references: [id])
  applicantId String             @db.Uuid
  applicant   User               @relation(fields: [applicantId], references: [id])
  status      ApplicationStatus  @default(pending)
  reason      String?            @db.Text
  reviewedBy  String?            @db.Uuid
  reviewer    User?              @relation("ApplicationReviewer", fields: [reviewedBy], references: [id])
  reviewNote  String?            @db.Text
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@unique([skillId, applicantId])
  @@index([skillId])
  @@index([applicantId])
  @@index([status])
  @@map("applications")
}

model Review {
  id        String   @id @default(uuid()) @db.Uuid
  skillId   String   @db.Uuid
  skill     Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)
  userId    String   @db.Uuid
  user      User     @relation(fields: [userId], references: [id])
  rating    Int      // 1-5
  comment   String?  @db.Text
  createdAt DateTime @default(now())

  @@unique([skillId, userId])
  @@index([skillId])
  @@map("reviews")
}
```

---

## 4. API 设计

### 4.1 基础信息

- **Base URL**: `http://localhost:4001/api`
- **认证方式**: Bearer Token (JWT)
- **响应格式**: JSON
- **分页参数**: `page` (默认1), `pageSize` (默认20, 最大100)
- **统一响应结构**:
  ```typescript
  // 列表
  { data: T[], meta: { page, pageSize, total, totalPages } }
  // 单条
  { data: T }
  // 错误
  { message: string, errors?: unknown, requestId: string }
  ```

### 4.2 接口清单

#### Auth 认证模块 `/api/auth`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/register` | 注册（IP 白名单保护） | ❌ |
| POST | `/auth/login` | 登录，返回 accessToken + refreshToken | ❌ |
| POST | `/auth/refresh` | 刷新 Token | ❌ |
| GET  | `/auth/me` | 获取当前用户信息 | ✅ |

#### Categories 分类模块 `/api/categories`

| 方法 | 路径 | 说明 | 认证 | 角色 |
|------|------|------|------|------|
| GET  | `/categories` | 获取分类树 | ✅ | all |
| GET  | `/categories/:id` | 获取分类详情 | ✅ | all |
| POST | `/categories` | 创建分类 | ✅ | admin |
| PUT  | `/categories/:id` | 更新分类 | ✅ | admin |
| DELETE | `/categories/:id` | 删除分类 | ✅ | admin |

#### Skills 技能模块 `/api/skills`

| 方法 | 路径 | 说明 | 认证 | 角色 |
|------|------|------|------|------|
| GET  | `/skills` | 技能列表（分页、筛选、排序） | ✅ | all |
| GET  | `/skills/:id` | 技能详情 | ✅ | all |
| POST | `/skills` | 创建技能（草稿） | ✅ | publisher |
| PUT  | `/skills/:id` | 更新技能 | ✅ | owner/admin |
| DELETE | `/skills/:id` | 删除技能（仅草稿） | ✅ | owner/admin |
| POST | `/skills/:id/publish` | 提交发布（→待审核） | ✅ | owner |
| POST | `/skills/:id/archive` | 归档技能 | ✅ | owner/admin |
| GET  | `/skills/my` | 我发布的技能 | ✅ | publisher |
| GET  | `/skills/:id/files` | 获取技能文件列表 | ✅ | all |
| POST | `/skills/:id/files` | 上传技能文件 | ✅ | owner |

#### Search 搜索模块 `/api/search`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET  | `/search` | 全文搜索（keyword + filters） | ✅ |
| GET  | `/search/suggest` | 搜索建议（自动补全） | ✅ |

**搜索筛选参数**:
```
keyword: 搜索关键词
category: 分类 slug
tags: 标签（逗号分隔）
status: published
sort: newest | downloads | rating | name
min_rating: 最低评分
page, pageSize
```

#### Applications 申请模块 `/api/applications`

| 方法 | 路径 | 说明 | 认证 | 角色 |
|------|------|------|------|------|
| POST | `/applications` | 申请使用技能 | ✅ | user |
| GET  | `/applications/my` | 我的申请列表 | ✅ | user |
| GET  | `/applications/skill/:skillId` | 技能的申请列表 | ✅ | owner/admin |
| PATCH | `/applications/:id` | 审批申请 | ✅ | owner/admin |

#### Reviews 评价模块 `/api/reviews`

| 方法 | 路径 | 说明 | 认证 | 角色 |
|------|------|------|------|------|
| GET  | `/reviews/skill/:skillId` | 获取技能评价列表 | ✅ | all |
| POST | `/reviews` | 提交评价 | ✅ | user |
| PUT  | `/reviews/:id` | 修改评价 | ✅ | owner |
| DELETE | `/reviews/:id` | 删除评价 | ✅ | owner/admin |

#### Admin 管理后台 `/api/admin`

| 方法 | 路径 | 说明 | 认证 | 角色 |
|------|------|------|------|------|
| GET  | `/admin/stats` | 仪表盘统计 | ✅ | admin |
| GET  | `/admin/skills/pending` | 待审核技能列表 | ✅ | admin |
| PATCH | `/admin/skills/:id/review` | 审核技能（通过/拒绝） | ✅ | admin |
| GET  | `/admin/users` | 用户管理列表 | ✅ | admin |
| PATCH | `/admin/users/:id` | 修改用户状态/角色 | ✅ | admin |

---

## 5. 关键业务流程

### 5.1 技能发布流程

```
创建草稿 → 上传文件 → 编辑完善 → 提交审核(pending_review)
                                        │
                              ┌─────────┴─────────┐
                              │                   │
                           通过(approved)       拒绝(rejected)
                              │                   │
                        发布(published)      修改后重新提交
                              │
                        用户可浏览/申请
```

### 5.2 技能申请流程

```
用户浏览技能 → 点击申请 → 填写申请理由 → 提交(pending)
                                              │
                                    ┌─────────┴─────────┐
                                    │                   │
                                 通过(approved)       拒绝(rejected)
                                    │
                              获得技能访问权限
```

### 5.3 搜索流程

```
输入关键词 → Redis 缓存检查
                │
        ┌───────┴───────┐
        │               │
    缓存命中          缓存未命中
    直接返回     →    PostgreSQL 全文搜索
        │               │
        │          写入 Redis 缓存(TTL 5min)
        │               │
        └───────┬───────┘
                │
            返回结果
```

---

## 6. Redis 缓存策略

| Key Pattern | TTL | 说明 |
|-------------|-----|------|
| `search:{hash}` | 5min | 搜索结果缓存 |
| `skill:{id}` | 10min | 技能详情缓存 |
| `categories:tree` | 30min | 分类树缓存 |
| `user:{id}` | 15min | 用户信息缓存 |
| `stats:dashboard` | 1min | 管理后台统计 |

**缓存失效策略**: 技能更新/删除时主动清除相关缓存。

---

## 7. 环境变量

```env
NODE_ENV=development
PORT=4001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skill_marketplace?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=2h
JWT_REFRESH_SECRET=change-me-refresh-in-production
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_ORIGIN=http://localhost:5174
```

---

## 8. 与前端对齐的接口约定

### 8.1 技能列表返回格式

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "skill-name",
      "slug": "skill-name",
      "version": "1.0.0",
      "description": "简短描述",
      "logoUrl": "https://...",
      "tags": ["agent", "automation"],
      "category": { "id": "uuid", "name": "AI Agent", "slug": "ai-agent" },
      "author": { "id": "uuid", "name": "张三", "avatar": "..." },
      "downloads": 128,
      "rating": 4.5,
      "reviewCount": 23,
      "status": "published",
      "publishedAt": "2026-05-10T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 }
}
```

### 8.2 技能详情返回格式

```json
{
  "data": {
    "id": "uuid",
    "name": "skill-name",
    "slug": "skill-name",
    "version": "1.0.0",
    "description": "技能描述",
    "readme": "# Markdown content...",
    "tags": ["agent"],
    "category": { "id": "uuid", "name": "AI Agent" },
    "author": { "id": "uuid", "name": "张三", "avatar": "..." },
    "homepageUrl": "https://...",
    "repoUrl": "https://...",
    "logoUrl": "https://...",
    "screenshots": ["https://..."],
    "files": [
      { "id": "uuid", "fileType": "source_code", "fileName": "skill.tar.gz", "fileSize": 1024000 }
    ],
    "downloads": 128,
    "rating": 4.5,
    "reviewCount": 23,
    "status": "published",
    "visibility": "public",
    "publishedAt": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

## 9. 开发里程碑

| 阶段 | 内容 | 预计工时 |
|------|------|----------|
| **P0 骨架** | 项目初始化 + DB Schema + 认证 + CRUD 骨架 | 2h |
| **P1 核心** | 技能 CRUD + 分类 + 发布流程 | 3h |
| **P2 搜索** | 全文搜索 + Redis 缓存 | 2h |
| **P3 申请** | 申请 + 审批流程 | 2h |
| **P4 评价** | 评分评论 + 管理后台 | 2h |

---

*等待 CTO 评审通过后开始 P0 骨架搭建。*
