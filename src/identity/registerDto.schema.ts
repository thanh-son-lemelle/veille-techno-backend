import { z } from 'zod';

export const registerSchema = z.strictObject({
  email: z.email({
    error: 'Adresse email invalide',
  }),

  password: z
    .string()
    .min(8, {
      error: 'Le mot de passe doit contenir au moins 8 caractères',
    })
    .max(24, {
      error: 'Le mot de passe doit contenir au maximum 24 caractères',
    }),

  name: z.string().trim().min(1, {
    error: 'Le nom est obligatoire',
  }),
});

export type RegisterInputDto = z.infer<typeof registerSchema>;