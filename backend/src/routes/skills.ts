import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import {
  createSkillSchema,
  updateSkillSchema,
  skillIdSchema,
  listSkillsSchema,
} from '../schemas/skill.js';

export const skillsRouter = Router();
skillsRouter.use(authRequired);

// 技能列表（公开）
skillsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { query } = listSkillsSchema.parse({ query: req.query });
    const pagination = parsePagination(query as Record<string, unknown>);

    const where: Prisma.SkillWhereInput = {};

    // requester/publisher 只看到自己的草稿；admin 看所有
    if (req.user!.role === 'admin') {
      // 全可见
    } else if (req.user!.role === 'publisher') {
      where.OR = [{ authorId: req.user!.id }, { status: 'published' }];
    } else {
      where.status = 'published';
    }

    if (query.category) where.category = { slug: query.category };
    if (query.tags) where.tags = { hasSome: query.tags.split(',') };
    if (query.status) where.status = query.status;
    if (query.authorId) where.authorId = query.authorId;

    const orderBy: Prisma.SkillOrderByWithRelationInput =
      query.sort === 'downloads'
        ? { downloads: 'desc' }
        : query.sort === 'rating'
          ? { rating: 'desc' }
          : query.sort === 'name'
            ? { name: 'asc' }
            : { publishedAt: 'desc' };

    const [skills, total] = await prisma.$transaction([
      prisma.skill.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true, avatar: true } },
          _count: { select: { files: true } },
        },
        orderBy,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.skill.count({ where }),
    ]);

    res.json({ data: skills, meta: buildMeta(total, pagination) });
  }),
);

// 我发布的技能
skillsRouter.get(
  '/my',
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Prisma.SkillWhereInput = { authorId: req.user!.id };

    const [skills, total] = await prisma.$transaction([
      prisma.skill.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { files: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.skill.count({ where }),
    ]);

    res.json({ data: skills, meta: buildMeta(total, pagination) });
  }),
);

// 技能详情
skillsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { params } = skillIdSchema.parse({ params: req.params });

    // 尝试从缓存读取
    const cacheKey = `skill:${params.id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ data: JSON.parse(cached) });

    const skill = await prisma.skill.findUnique({
      where: { id: params.id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, name: true, email: true, avatar: true } },
        files: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!skill) throw new HttpError(404, '技能不存在');

    // 缓存技能详情 10min
    await redis.setex(cacheKey, 600, JSON.stringify(skill));

    res.json({ data: skill });
  }),
);

// 创建技能（草稿）
skillsRouter.post(
  '/',
  requireRoles('admin', 'publisher'),
  asyncHandler(async (req, res) => {
    const { body } = createSkillSchema.parse({ body: req.body });

    // 检查 slug 唯一性
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = await prisma.skill.findUnique({ where: { slug } });
    if (existing) throw new HttpError(409, '技能 slug 已存在，请修改技能名称');

    const skill = await prisma.skill.create({
      data: {
        name: body.name,
        slug,
        version: body.version,
        description: body.description,
        readme: body.readme,
        authorId: req.user!.id,
        categoryId: body.categoryId,
        tags: body.tags,
        homepageUrl: body.homepageUrl,
        repoUrl: body.repoUrl,
        logoUrl: body.logoUrl,
        screenshots: body.screenshots,
        visibility: body.visibility,
        status: 'draft',
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    res.status(201).json({ data: skill });
  }),
);

// 更新技能
skillsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { params, body } = updateSkillSchema.parse({ params: req.params, body: req.body });
    const existing = await prisma.skill.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, '技能不存在');

    // 权限检查：仅作者或 admin
    if (req.user!.role !== 'admin' && existing.authorId !== req.user!.id) {
      throw new HttpError(403, '无权编辑该技能');
    }

    // 仅草稿状态可编辑
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new HttpError(400, '仅草稿或已拒绝的技能可编辑');
    }

    const skill = await prisma.skill.update({
      where: { id: params.id },
      data: body,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    // 清除缓存
    await redis.del(`skill:${params.id}`);

    res.json({ data: skill });
  }),
);

// 删除技能（仅草稿）
skillsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { params } = skillIdSchema.parse({ params: req.params });
    const existing = await prisma.skill.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, '技能不存在');
    if (req.user!.role !== 'admin' && existing.authorId !== req.user!.id) {
      throw new HttpError(403, '无权删除该技能');
    }
    if (existing.status !== 'draft') throw new HttpError(400, '仅草稿状态的技能可删除');

    await prisma.skill.delete({ where: { id: params.id } });
    await redis.del(`skill:${params.id}`);
    res.status(204).send();
  }),
);

// 提交发布（→ pending_review）
skillsRouter.post(
  '/:id/publish',
  asyncHandler(async (req, res) => {
    const { params } = skillIdSchema.parse({ params: req.params });
    const existing = await prisma.skill.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, '技能不存在');
    if (existing.authorId !== req.user!.id) throw new HttpError(403, '无权操作');
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new HttpError(400, '仅草稿或已拒绝的技能可提交发布');
    }

    const skill = await prisma.skill.update({
      where: { id: params.id },
      data: { status: 'pending_review' },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    await redis.del(`skill:${params.id}`);
    res.json({ data: skill });
  }),
);

// 归档技能
skillsRouter.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const { params } = skillIdSchema.parse({ params: req.params });
    const existing = await prisma.skill.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, '技能不存在');
    if (req.user!.role !== 'admin' && existing.authorId !== req.user!.id) {
      throw new HttpError(403, '无权操作');
    }

    const skill = await prisma.skill.update({
      where: { id: params.id },
      data: { status: 'archived' },
    });

    await redis.del(`skill:${params.id}`);
    res.json({ data: skill });
  }),
);

// 获取技能文件列表
skillsRouter.get(
  '/:id/files',
  asyncHandler(async (req, res) => {
    const { params } = skillIdSchema.parse({ params: req.params });
    const files = await prisma.skillFile.findMany({
      where: { skillId: params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: files });
  }),
);

// 上传技能文件（简化版，不处理实际文件存储）
skillsRouter.post(
  '/:id/files',
  asyncHandler(async (req, res) => {
    const { params } = skillIdSchema.parse({ params: req.params });
    const existing = await prisma.skill.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, '技能不存在');
    if (req.user!.role !== 'admin' && existing.authorId !== req.user!.id) {
      throw new HttpError(403, '无权操作');
    }
    // TODO: 实际文件上传通过 multer 中间件处理
    res.status(501).json({ message: '文件上传功能待实现' });
  }),
);
