import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { asyncHandler } from '../utils/async-handler.js';
import { authRequired } from '../middleware/auth.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

export const searchRouter = Router();
searchRouter.use(authRequired);

// 全文搜索
searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const keyword = (req.query.keyword as string) || '';
    const category = req.query.category as string | undefined;
    const tags = req.query.tags as string | undefined;
    const minRating = Number(req.query.min_rating) || 0;
    const sort = (req.query.sort as string) || 'newest';

    // 构建缓存 key
    const cacheKey = `search:${JSON.stringify({ keyword, category, tags, minRating, sort, page: pagination.page, pageSize: pagination.pageSize })}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const where: Prisma.SkillWhereInput = { status: 'published' };
    if (minRating > 0) where.rating = { gte: minRating };
    if (category) where.category = { slug: category };
    if (tags) where.tags = { hasSome: tags.split(',') };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { tags: { hasSome: [keyword] } },
      ];
    }

    const orderBy: Prisma.SkillOrderByWithRelationInput =
      sort === 'downloads' ? { downloads: 'desc' }
        : sort === 'rating' ? { rating: 'desc' }
          : sort === 'name' ? { name: 'asc' }
            : { publishedAt: 'desc' };

    const [skills, total] = await prisma.$transaction([
      prisma.skill.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true, avatar: true } },
        },
        orderBy,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.skill.count({ where }),
    ]);

    const result = { data: skills, meta: buildMeta(total, pagination) };

    // 缓存 5min
    await redis.setex(cacheKey, 300, JSON.stringify(result));

    res.json(result);
  }),
);

// 搜索建议（返回匹配的技能名称列表）
searchRouter.get(
  '/suggest',
  asyncHandler(async (req, res) => {
    const keyword = (req.query.keyword as string) || '';
    const limit = Math.min(Number(req.query.limit) || 8, 20);

    if (!keyword || keyword.length < 1) {
      res.json({ data: [] });
      return;
    }

    const skills = await prisma.skill.findMany({
      where: {
        status: 'published',
        name: { contains: keyword, mode: 'insensitive' },
      },
      select: {
        name: true,
        slug: true,
        category: { select: { name: true } },
        logoUrl: true,
      },
      take: limit,
      orderBy: { downloads: 'desc' },
    });

    res.json({
      data: skills.map(s => ({
        name: s.name,
        slug: s.slug,
        category: s.category.name,
        logoUrl: s.logoUrl,
      })),
    });
  }),
);
