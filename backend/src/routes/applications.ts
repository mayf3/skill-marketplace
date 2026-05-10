import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { authRequired } from '../middleware/auth.js';
import { createApplicationSchema, reviewApplicationSchema } from '../schemas/application.js';

export const applicationsRouter = Router();
applicationsRouter.use(authRequired);

// 申请使用技能
applicationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { body } = createApplicationSchema.parse({ body: req.body });

    const skill = await prisma.skill.findUnique({ where: { id: body.skillId } });
    if (!skill) throw new HttpError(404, '技能不存在');
    if (skill.status !== 'published') throw new HttpError(400, '该技能未发布');

    // 检查重复申请
    const existing = await prisma.application.findUnique({
      where: { skillId_applicantId: { skillId: body.skillId, applicantId: req.user!.id } },
    });
    if (existing) throw new HttpError(409, '已申请过该技能');

    const application = await prisma.application.create({
      data: {
        skillId: body.skillId,
        applicantId: req.user!.id,
        reason: body.reason,
      },
      include: {
        skill: { select: { id: true, name: true } },
        applicant: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ data: application });
  }),
);

// 我的申请列表
applicationsRouter.get(
  '/my',
  asyncHandler(async (req, res) => {
    const applications = await prisma.application.findMany({
      where: { applicantId: req.user!.id },
      include: {
        skill: { select: { id: true, name: true, slug: true, logoUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: applications });
  }),
);

// 技能的申请列表（作者/admin 可查看）
applicationsRouter.get(
  '/skill/:skillId',
  asyncHandler(async (req, res) => {
    const skillId = req.params.skillId as string;
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new HttpError(404, '技能不存在');
    if (req.user!.role !== 'admin' && skill.authorId !== req.user!.id) {
      throw new HttpError(403, '无权查看');
    }

    const applications = await prisma.application.findMany({
      where: { skillId },
      include: {
        applicant: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: applications });
  }),
);

// 审批申请
applicationsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { params, body } = reviewApplicationSchema.parse({ params: req.params, body: req.body });

    const application = await prisma.application.findUnique({
      where: { id: params.id },
      include: { skill: { select: { authorId: true, name: true } } },
    });
    if (!application) throw new HttpError(404, '申请不存在');
    if (application.status !== 'pending') throw new HttpError(400, '该申请已处理');

    // 仅技能作者或 admin 可审批
    if (req.user!.role !== 'admin' && application.skill.authorId !== req.user!.id) {
      throw new HttpError(403, '无权审批');
    }

    const updated = await prisma.application.update({
      where: { id: params.id },
      data: {
        status: body.status,
        reviewedBy: req.user!.id,
        reviewNote: body.reviewNote,
      },
      include: {
        applicant: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
    });

    res.json({ data: updated });
  }),
);
