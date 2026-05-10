# Skill Marketplace 前端技术设计文档

> 作者：前端开发工程师 | 日期：2026-05-10 | 版本：v1.0-draft

---

## 1. 项目概述

构建内部技能商城（Skill Marketplace）前端，提供技能浏览、搜索、详情查看、申请使用、发布管理和管理后台等功能。

### 1.1 技术栈

| 组件 | 选型 | 版本 |
|------|------|------|
| 框架 | React | ^18 |
| 语言 | TypeScript | ^5 |
| 构建 | Vite | ^6 |
| UI 库 | Ant Design | ^5 |
| 路由 | React Router | ^6 |
| HTTP | Axios | ^1 |
| Markdown | react-markdown + remark-gfm | — |
| 拖拽 | @dnd-kit/core（管理后台排序） | — |
| 图标 | @ant-design/icons | — |

### 1.2 基础约束

- 端口：**5174**（开发环境）
- API 代理：`/api` → `http://localhost:4001`
- 项目目录：`~/workspace/project/skill-marketplace/frontend`
- UI 风格与 Agent 开发中心保持一致（Ant Design + 蓝色主题）

---

## 2. 目录结构

```
frontend/
├── public/
├── src/
│   ├── api/
│   │   ├── client.ts            # Axios 实例 + 拦截器
│   │   └── types.ts             # API 类型定义
│   ├── components/
│   │   ├── AppLayout.tsx        # 主布局（侧边栏+顶栏）
│   │   ├── ProtectedRoute.tsx   # 认证路由守卫
│   │   ├── SkillCard.tsx        # 技能卡片组件
│   │   ├── SkillGrid.tsx        # 技能网格展示
│   │   ├── CategoryTree.tsx     # 分类侧边栏
│   │   ├── SearchBar.tsx        # 搜索栏（含建议）
│   │   ├── MarkdownRenderer.tsx # Markdown 渲染
│   │   ├── RatingStars.tsx      # 星级评分
│   │   ├── FileUploader.tsx     # 文件上传组件
│   │   └── StatCard.tsx         # 统计卡片
│   ├── constants/
│   │   └── options.ts           # 状态/角色等映射
│   ├── contexts/
│   │   └── AuthContext.tsx       # 认证上下文
│   ├── pages/
│   │   ├── LoginPage.tsx        # 登录/注册
│   │   ├── RegisterPage.tsx     # 注册页
│   │   ├── BrowsePage.tsx       # 技能浏览首页
│   │   ├── SkillDetailPage.tsx  # 技能详情页
│   │   ├── SearchPage.tsx       # 搜索结果页
│   │   ├── MySkillsPage.tsx     # 我发布的技能
│   │   ├── SkillEditorPage.tsx  # 技能编辑/发布
│   │   ├── MyApplicationsPage.tsx # 我的申请
│   │   └── admin/
│   │       ├── DashboardPage.tsx   # 管理仪表盘
│   │       ├── ReviewPage.tsx      # 技能审核
│   │       ├── CategoryManagePage.tsx # 分类管理
│   │       └── UserManagePage.tsx  # 用户管理
│   ├── styles/
│   │   └── index.css            # 全局样式
│   ├── App.tsx                  # 路由配置
│   ├── main.tsx                 # 入口
│   └── vite-env.d.ts            # 环境变量类型
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env                         # 开发环境
├── .env.production              # 生产环境
└── Dockerfile
```

---

## 3. 路由设计

### 3.1 路由表

```typescript
// 公开路由（无需登录）
/login                    → LoginPage
/register                 → RegisterPage

// 浏览路由（登录后可访问）
/                         → BrowsePage          // 技能浏览首页
/search                   → SearchPage          // 搜索结果
/skills/:id               → SkillDetailPage     // 技能详情

// 发布者路由（publisher 角色）
/my/skills                → MySkillsPage        // 我发布的技能
/my/skills/new            → SkillEditorPage     // 新建技能
/my/skills/:id/edit       → SkillEditorPage     // 编辑技能
/my/applications          → MyApplicationsPage  // 我的申请

// 管理后台路由（admin 角色）
/admin/dashboard          → DashboardPage       // 管理仪表盘
/admin/reviews            → ReviewPage          // 技能审核
/admin/categories         → CategoryManagePage  // 分类管理
/admin/users              → UserManagePage      // 用户管理
```

### 3.2 路由守卫

```
未登录 → 可浏览 /, /search, /skills/:id（只读）
未登录 → 访问 /my/*, /admin/* → 重定向到 /login
publisher → 可访问 /my/*
admin → 可访问 /admin/* + /my/*
```

---

## 4. 页面清单与组件拆分

### 4.1 登录/注册页

| 页面 | 核心组件 | 说明 |
|------|----------|------|
| LoginPage | Form, Input, Button | 邮箱+密码登录，Token 快速登录 |
| RegisterPage | Form, Input, Select, Button | 姓名+邮箱+密码+角色选择 |

### 4.2 浏览首页 (BrowsePage)

```
┌─────────────────────────────────────────────────────┐
│ Header: Logo + SearchBar + 用户信息                    │
├───────────┬─────────────────────────────────────────┤
│           │ 面包屑 + 排序选项（最新/下载/评分）         │
│ Category  │                                         │
│ Tree      │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│           │ │Skill │ │Skill │ │Skill │ │Skill │    │
│ - 全部    │ │Card  │ │Card  │ │Card  │ │Card  │    │
│ - AI Agent│ │      │ │      │ │      │ │      │    │
│ - 搜索工具│ └──────┘ └──────┘ └──────┘ └──────┘    │
│ - 数据处理│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ - ...     │ │Skill │ │Skill │ │Skill │ │Skill │    │
│           │ │Card  │ │Card  │ │Card  │ │Card  │    │
│           │ └──────┘ └──────┘ └──────┘ └──────┘    │
│           │                                         │
│           │              分页器                       │
└───────────┴─────────────────────────────────────────┘
```

**核心组件**：
- `CategoryTree` — 左侧分类树，选中分类筛选技能
- `SkillGrid` — 技能卡片网格，响应式布局（1-4列）
- `SkillCard` — 单个技能卡片（Logo + 名称 + 描述 + 标签 + 评分 + 下载量）
- `SearchBar` — 搜索框（含自动补全建议）

### 4.3 技能详情页 (SkillDetailPage)

```
┌─────────────────────────────────────────────────────┐
│ Header                                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Logo  技能名称  版本号              [申请使用] [评分] │
│  作者 · 分类 · 标签                                  │
│                                                     │
├─────────────────────────────────┬───────────────────┤
│                                 │                   │
│  Tab: 说明 / 文件 / 评价        │  侧边栏信息       │
│                                 │                   │
│  [说明] Markdown 渲染 SKILL.md  │  下载量: 128      │
│                                 │  评分: ⭐4.5(23)  │
│  [文件] 文件列表+下载            │  作者: 张三       │
│                                 │  版本: 1.0.0      │
│  [评价] 评价列表+提交评价表单    │  主页链接         │
│                                 │  仓库链接         │
│                                 │  发布时间         │
│                                 │                   │
└─────────────────────────────────┴───────────────────┘
```

**核心组件**：
- `MarkdownRenderer` — 渲染 SKILL.md 的 Markdown 内容
- `RatingStars` — 星级评分展示和输入
- `FileList` — 技能文件列表

### 4.4 搜索结果页 (SearchPage)

- 复用 `SkillGrid` + `SkillCard`
- 搜索框 + 筛选条件（分类、标签、评分范围）
- 高亮搜索关键词

### 4.5 技能编辑/发布页 (SkillEditorPage)

```
┌─────────────────────────────────────────────────────┐
│ Header                                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  创建新技能 / 编辑技能                                │
│                                                     │
│  ┌─ 基本信息 ──────────────────────────────────────┐ │
│  │ 技能名称: [________]                             │ │
│  │ 版本号:   [1.0.0]                               │ │
│  │ 分类:     [下拉选择]                             │ │
│  │ 标签:     [Tag输入]                              │ │
│  │ 简短描述: [________]                             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ 详细说明 (Markdown) ──────────────────────────┐  │
│  │ [编辑器工具栏: 粗体/斜体/链接/图片/代码]         │  │
│  │ [                                          ]    │  │
│  │ [  Markdown 编辑区域                        ]    │  │
│  │ [                                          ]    │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 链接和资源 ────────────────────────────────────┐ │
│  │ 主页 URL:  [________]                           │ │
│  │ 仓库 URL:  [________]                           │ │
│  │ Logo 上传: [拖拽上传]                            │ │
│  │ 截图上传:  [拖拽上传，多张]                       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ 技能文件 ──────────────────────────────────────┐ │
│  │ [拖拽上传 .tar.gz / .zip]                       │ │
│  │ 文件列表: skill.tar.gz (1.2MB) [删除]           │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  [保存草稿]  [提交审核]                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**核心组件**：
- `FileUploader` — 文件拖拽上传（支持 Logo/截图/技能文件）
- Markdown 编辑区域（textarea + 实时预览）

### 4.6 管理后台

| 页面 | 说明 |
|------|------|
| DashboardPage | 统计概览（技能总数/待审核/用户数/下载量）+ 趋势图 |
| ReviewPage | 待审核技能列表 → 点击进入审核（查看详情 + 通过/拒绝） |
| CategoryManagePage | 分类树管理（CRUD + 拖拽排序） |
| UserManagePage | 用户列表（修改角色/禁用） |

---

## 5. API 对接清单

### 5.1 前端 API Client

```typescript
// api/client.ts — Axios 实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 15000
});

// 请求拦截：自动加 Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sm-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截：401 自动跳转登录
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sm-token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 5.2 接口调用映射

| 前端页面 | 调用接口 | 说明 |
|----------|----------|------|
| BrowsePage | `GET /skills` + `GET /categories` | 技能列表 + 分类树 |
| SearchPage | `GET /search` | 搜索结果 |
| SkillDetailPage | `GET /skills/:id` + `GET /reviews/skill/:id` + `GET /skills/:id/files` | 详情 + 评价 + 文件 |
| SkillEditorPage | `POST /skills` / `PUT /skills/:id` + `POST /skills/:id/files` + `POST /skills/:id/publish` | 创建/编辑 + 上传 + 提交 |
| MySkillsPage | `GET /skills/my` | 我的技能列表 |
| MyApplicationsPage | `GET /applications/my` | 我的申请列表 |
| SearchBar | `GET /search/suggest` | 搜索建议 |
| LoginPage | `POST /auth/login` | 登录 |
| RegisterPage | `POST /auth/register` | 注册 |
| DashboardPage | `GET /admin/stats` | 管理统计 |
| ReviewPage | `GET /admin/skills/pending` + `PATCH /admin/skills/:id/review` | 审核 |
| CategoryManagePage | `GET /categories` + `POST/PUT/DELETE /categories` | 分类管理 |
| UserManagePage | `GET /admin/users` + `PATCH /admin/users/:id` | 用户管理 |

---

## 6. 环境变量

```env
# .env（开发环境）
VITE_API_BASE_URL=/api

# .env.production（生产环境）
VITE_API_BASE_URL=http://<SERVER_IP>:4001/api
VITE_IS_PUBLIC_MODE=false
```

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true
      }
    }
  }
});
```

---

## 7. 组件复用策略

与 Agent 开发中心（agent-dev-center）保持一致的组件：

| 组件 | 来源 | 说明 |
|------|------|------|
| AppLayout | 新写但风格一致 | 侧边栏 + 顶栏布局 |
| ProtectedRoute | 参考实现 | 认证路由守卫 |
| AuthContext | 参考实现 | 认证上下文 |
| StatCard | 新写 | 统计卡片（类似仪表盘） |
| StatusTag | 新写 | 状态标签映射 |

UI 规范：
- 主题色：`#1677ff`（Ant Design 默认蓝）
- 圆角：`8px`
- 字体：系统默认无衬线字体
- 卡片阴影：`0 1px 2px rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02)`

---

## 8. TypeScript 类型定义

```typescript
// api/types.ts

export type UserRole = 'admin' | 'publisher' | 'user';
export type SkillStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published' | 'archived';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type FileType = 'source_code' | 'icon' | 'screenshot' | 'document';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status: 'active' | 'disabled';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  parentId?: string;
  children?: Category[];
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  readme?: string;
  tags: string[];
  category: Pick<Category, 'id' | 'name' | 'slug'>;
  author: Pick<User, 'id' | 'name' | 'avatar'>;
  homepageUrl?: string;
  repoUrl?: string;
  logoUrl?: string;
  screenshots: string[];
  files?: SkillFile[];
  downloads: number;
  rating: number;
  reviewCount: number;
  status: SkillStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillFile {
  id: string;
  fileType: FileType;
  fileName: string;
  fileSize: number;
  fileUrl: string;
}

export interface Application {
  id: string;
  skill: Pick<Skill, 'id' | 'name' | 'logoUrl' | 'slug'>;
  status: ApplicationStatus;
  reason?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface DashboardStats {
  totalSkills: number;
  publishedSkills: number;
  pendingReview: number;
  totalUsers: number;
  totalDownloads: number;
  totalApplications: number;
}
```

---

## 9. 开发里程碑

| 阶段 | 内容 | 预计工时 |
|------|------|----------|
| **P0 骨架** | 项目初始化 + 路由 + 布局 + 认证 | 2h |
| **P1 浏览** | 首页 + 分类 + 技能卡片 + 详情页 | 3h |
| **P2 搜索** | 搜索框 + 搜索结果 + 自动补全 | 1.5h |
| **P3 发布** | 技能编辑器 + 文件上传 + 发布流程 | 2.5h |
| **P4 申请** | 申请流程 + 我的申请 + 评价 | 1.5h |
| **P5 管理后台** | 仪表盘 + 审核 + 分类管理 + 用户管理 | 2.5h |
| **P6 联调** | 与后端联调 + Bug 修复 | 2h |

**总计：~15h**

---

## 10. 待后端确认事项

1. ✅ `POST /api/skills/:id/files` 是否 multipart/form-data？文件大小限制？
2. ✅ `readme` 返回原始 Markdown，前端渲染？
3. ✅ `GET /api/search/suggest` 返回格式？
4. ✅ `GET /api/skills` 的 `sort` 参数支持值？
5. ✅ 前端开发端口 5174，代理指向 4001？

---

*等待后端工程师确认 + CTO 评审通过后开始 P0 骨架搭建。*
