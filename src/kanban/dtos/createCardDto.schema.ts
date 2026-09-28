import { z } from 'zod';

export const createCardSchema = z.strictObject({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  position: z.int32().optional(),
});

export type CreateCardInputDto = z.infer<typeof createCardSchema>;
