import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { authRequired } from '../middleware/auth.js';
import { createReviewSchema, updateReviewSchema } from '../schemas/review.js';

export const reviewsRouter = Router();
reviewsRouter.use(authRequired);

// 获取技能评价
reviewsRouter.get(
  '/skill/:skillId',
  asyncHandler(async (req, res) => {
    const skillId = req.params.skillId as string;
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new HttpError(404, '技能不存在');

    const reviews = await prisma.review.findMany({
      where: { skillId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: reviews });
  }),
);

// 提交评价
reviewsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { body } = createReviewSchema.parse({ body: req.body });

    const skill = await prisma.skill.findUnique({ where: { id: body.skillId } });
    if (!skill) throw new HttpError(404, '技能不存在');
    if (skill.status !== 'published') throw new HttpError(400, '仅已发布技能可评价');

    const existing = await prisma.review.findUnique({
      where: { skillId_userId: { skillId: body.skillId, userId: req.user!.id } },
    });
    if (existing) throw new HttpError(409, '已评价过该技能');

    const review = await prisma.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: { skillId: body.skillId, userId: req.user!.id, rating: body.rating, comment: body.comment },
      });
      const agg = await tx.review.aggregate({ where: { skillId: body.skillId }, _avg: { rating: true }, _count: true });
      await tx.skill.update({
        where: { id: body.skillId },
        data: { rating: agg._avg.rating ?? 0, reviewCount: agg._count },
      });
      return r;
    });

    await redis.del(`skill:${body.skillId}`);
    res.status(201).json({ data: review });
  }),
);

// 修改评价
reviewsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { params, body } = updateReviewSchema.parse({ params: req.params, body: req.body });
    const reviewId = params.id;

    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) throw new HttpError(404, '评价不存在');
    if (existing.userId !== req.user!.id) throw new HttpError(403, '无权修改');

    const review = await prisma.$transaction(async (tx) => {
      const r = await tx.review.update({ where: { id: reviewId }, data: { rating: body.rating, comment: body.comment } });
      const agg = await tx.review.aggregate({ where: { skillId: existing.skillId }, _avg: { rating: true }, _count: true });
      await tx.skill.update({ where: { id: existing.skillId }, data: { rating: agg._avg.rating ?? 0, reviewCount: agg._count } });
      return r;
    });

    await redis.del(`skill:${existing.skillId}`);
    res.json({ data: review });
  }),
);

// 删除评价
reviewsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const reviewId = req.params.id as string;
    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) throw new HttpError(404, '评价不存在');
    if (req.user!.role !== 'admin' && existing.userId !== req.user!.id) {
      throw new HttpError(403, '无权删除');
    }

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: reviewId } });
      const agg = await tx.review.aggregate({ where: { skillId: existing.skillId }, _avg: { rating: true }, _count: true });
      await tx.skill.update({ where: { id: existing.skillId }, data: { rating: agg._avg.rating ?? 0, reviewCount: agg._count } });
    });

    await redis.del(`skill:${existing.skillId}`);
    res.status(204).send();
  }),
);
