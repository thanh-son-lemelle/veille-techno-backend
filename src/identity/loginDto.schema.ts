import { z } from 'zod';

export const loginSchema = z.strictObject({
  email: z.email({ error: 'Adresse email invalide' }),
  password: z.string().min(1, { error: 'Le mot de passe est obligatoire' }),
});

export type LoginInputDto = z.infer<typeof loginSchema>;
