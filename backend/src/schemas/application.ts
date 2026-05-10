import { z } from 'zod';

export const createApplicationSchema = z.object({
  body: z.object({
    skillId: z.string().uuid(),
    reason: z.string().max(1000).optional(),
  }),
});

export const reviewApplicationSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['approved', 'rejected']),
    reviewNote: z.string().max(1000).optional(),
  }),
});
