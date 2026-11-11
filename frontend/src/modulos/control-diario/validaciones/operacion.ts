import { z } from 'zod';
import { fecha, texto } from '../../../compartido/validaciones/campos';
export const esquemaOperacion = z.object({
  fecha,
  maquinariaId: texto,
  actividad: texto,
  operador: texto,
});
