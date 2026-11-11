import { z } from 'zod';
export const texto = z
  .string()
  .trim()
  .min(1, 'Este campo es obligatorio.')
  .max(120, 'Máximo 120 caracteres.');
export const fecha = z.iso
  .date('Ingresa una fecha válida.')
  .refine(
    (valor) => valor >= '2000-01-01' && valor <= '2100-12-31',
    'La fecha debe estar entre 2000 y 2100.',
  );
export const cantidad = z
  .number({ error: 'Ingresa un número válido.' })
  .min(0, 'No puede ser negativo.')
  .max(9999999, 'La cantidad es demasiado grande.');
