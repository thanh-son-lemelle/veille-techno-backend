import { z } from 'zod';
import { createListSchema } from './createListDto.schema';

export const updateListSchema = createListSchema.partial();

export type UpdateListInputDto = z.infer<typeof updateListSchema>;
