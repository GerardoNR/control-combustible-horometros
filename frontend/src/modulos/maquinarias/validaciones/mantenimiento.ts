import { z } from 'zod';
import { cantidad, fecha, texto } from '../../../compartido/validaciones/campos';
export const esquemaMantenimiento = z.object({
  maquinariaId: texto,
  fecha,
  lecturaHorometro: cantidad,
  tipoServicio: texto,
  observaciones: z.string().trim().max(500).optional(),
});
