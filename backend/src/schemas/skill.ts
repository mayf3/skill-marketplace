import { z } from 'zod';

export const createSkillSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    version: z.string().default('1.0.0'),
    description: z.string().min(10, '描述至少10个字符').max(2000),
    readme: z.string().optional(),
    categoryId: z.string().uuid(),
    tags: z.array(z.string()).max(20).default([]),
    homepageUrl: z.string().url().optional(),
    repoUrl: z.string().url().optional(),
    logoUrl: z.string().url().optional(),
    screenshots: z.array(z.string().url()).max(10).default([]),
    visibility: z.enum(['public', 'internal']).default('public'),
  }),
});

export const updateSkillSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    version: z.string().optional(),
    description: z.string().min(10).max(2000).optional(),
    readme: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    tags: z.array(z.string()).max(20).optional(),
    homepageUrl: z.string().url().optional().nullable(),
    repoUrl: z.string().url().optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
    screenshots: z.array(z.string().url()).max(10).optional(),
    visibility: z.enum(['public', 'internal']).optional(),
  }),
});

export const skillIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listSkillsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    category: z.string().optional(),
    tags: z.string().optional(),
    status: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'published', 'archived']).optional(),
    sort: z.enum(['newest', 'downloads', 'rating', 'name']).default('newest'),
    authorId: z.string().uuid().optional(),
  }),
});
