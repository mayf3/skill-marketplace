import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(50),
    slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/),
    description: z.string().max(500).optional(),
    icon: z.string().optional(),
    parentId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().default(0),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(1).max(50).optional(),
    slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().optional(),
  }),
});

export const categoryIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
