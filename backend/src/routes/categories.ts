import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { categoryIdSchema, createCategorySchema, updateCategorySchema } from '../schemas/category.js';

export const categoriesRouter = Router();
categoriesRouter.use(authRequired);

// 获取分类树
categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: { orderBy: { sortOrder: 'asc' }, include: { _count: { select: { skills: true } } } },
        _count: { select: { skills: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ data: categories });
  }),
);

// 获取单个分类
categoriesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { params } = categoryIdSchema.parse({ params: req.params });
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: { children: { orderBy: { sortOrder: 'asc' } }, parent: true, _count: { select: { skills: true } } },
    });
    if (!category) throw new HttpError(404, '分类不存在');
    res.json({ data: category });
  }),
);

// 创建分类
categoriesRouter.post(
  '/',
  requireRoles('admin'),
  asyncHandler(async (req, res) => {
    const { body } = createCategorySchema.parse({ body: req.body });
    const category = await prisma.category.create({ data: body });
    res.status(201).json({ data: category });
  }),
);

// 更新分类
categoriesRouter.put(
  '/:id',
  requireRoles('admin'),
  asyncHandler(async (req, res) => {
    const { params, body } = updateCategorySchema.parse({ params: req.params, body: req.body });
    const existing = await prisma.category.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, '分类不存在');

    const category = await prisma.category.update({ where: { id: params.id }, data: body });
    res.json({ data: category });
  }),
);

// 删除分类
categoriesRouter.delete(
  '/:id',
  requireRoles('admin'),
  asyncHandler(async (req, res) => {
    const { params } = categoryIdSchema.parse({ params: req.params });
    const count = await prisma.skill.count({ where: { categoryId: params.id } });
    if (count > 0) throw new HttpError(400, '该分类下有技能，无法删除');

    await prisma.category.delete({ where: { id: params.id } });
    res.status(204).send();
  }),
);
