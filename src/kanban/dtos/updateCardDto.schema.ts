import { z } from 'zod';
import { createCardSchema } from './createCardDto.schema';

export const updateCardSchema = createCardSchema.partial().extend({
  listId: z.uuid().optional(),
});

export type UpdateCardInputDto = z.infer<typeof updateCardSchema>;
