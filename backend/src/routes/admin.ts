import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

export const adminRouter = Router();
adminRouter.use(authRequired, requireRoles('admin'));

// 仪表盘统计
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [totalSkills, publishedSkills, pendingSkills, totalUsers, totalApps, pendingApps] =
      await Promise.all([
        prisma.skill.count(),
        prisma.skill.count({ where: { status: 'published' } }),
        prisma.skill.count({ where: { status: 'pending_review' } }),
        prisma.user.count(),
        prisma.application.count(),
        prisma.application.count({ where: { status: 'pending' } }),
      ]);

    const categoryStats = await prisma.category.findMany({
      select: { name: true, _count: { select: { skills: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      data: {
        skills: { total: totalSkills, published: publishedSkills, pending: pendingSkills },
        users: { total: totalUsers },
        applications: { total: totalApps, pending: pendingApps },
        categories: categoryStats.map(c => ({ name: c.name, count: c._count.skills })),
      },
    });
  }),
);

// 待审核技能
adminRouter.get(
  '/skills/pending',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    const [skills, total] = await prisma.$transaction([
      prisma.skill.findMany({
        where: { status: 'pending_review' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.skill.count({ where: { status: 'pending_review' } }),
    ]);

    res.json({
      data: skills,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }),
);

// 审核技能（通过/拒绝）
adminRouter.patch(
  '/skills/:id/review',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { status, rejectReason } = req.body as {
      status: 'approved' | 'rejected';
      rejectReason?: string;
    };

    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, '状态必须是 approved 或 rejected');
    }

    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, '技能不存在');
    if (existing.status !== 'pending_review') throw new HttpError(400, '该技能不在待审核状态');

    const skill = await prisma.skill.update({
      where: { id },
      data: {
        status: status === 'approved' ? 'published' : 'rejected',
        publishedAt: status === 'approved' ? new Date() : undefined,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, name: true } },
      },
    });

    res.json({ data: { ...skill, reviewAction: status, rejectReason: rejectReason ?? null } });
  }),
);

// 用户管理列表
adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        select: {
          id: true, name: true, email: true, role: true, status: true, avatar: true,
          createdAt: true, _count: { select: { skills: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count(),
    ]);

    res.json({
      data: users,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }),
);

// 修改用户状态/角色
adminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { role, status } = req.body as {
      role?: 'admin' | 'publisher' | 'user';
      status?: 'active' | 'disabled';
    };

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, '用户不存在');
    if (id === req.user!.id) throw new HttpError(400, '不能修改自己的权限');

    const user = await prisma.user.update({
      where: { id },
      data: { role, status },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    res.json({ data: user });
  }),
);
