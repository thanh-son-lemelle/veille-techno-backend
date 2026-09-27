import { z } from 'zod';

export const createListSchema = z.strictObject({
  title: z.string().trim().min(1),
  position: z.int32().optional(),
});

export type CreateListInputDto = z.infer<typeof createListSchema>;
