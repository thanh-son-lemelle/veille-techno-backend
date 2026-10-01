import { z } from 'zod';
import { UserRole } from '../user.entity';

export const updateUserSchema = z.strictObject({
  name: z.string().trim().min(1).optional(),
  email: z.email().optional(),
  role: z.enum(UserRole).optional(),
});

export type UpdateUserInputDto = z.infer<typeof updateUserSchema>;
