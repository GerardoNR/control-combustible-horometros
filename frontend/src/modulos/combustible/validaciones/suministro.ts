import { z } from 'zod';
import { cantidad, fecha, texto } from '../../../compartido/validaciones/campos';
const nombreOpcional = z.string().trim().max(120, 'Máximo 120 caracteres.').optional();
export const esquemaSuministro = z.object({
  actividad: z.string().trim().max(120).optional(),
  fecha,
  maquinariaId: texto,
  regimenOperacion: z.enum(['Trabajo', 'Ralentí', 'Mixto', '']).optional(),
  litrosSolicitados: cantidad.positive('La solicitud debe ser mayor a cero.'),
  litrosCargados: cantidad,
  tipoCombustible: texto,
  tipoCombustibleId: z.string().optional(),
  ubicacionId: z.string().optional(),
  responsableLegado: z.string().optional(),
  operador: texto,
  operadorId: z.string().optional(),
  asignacionId: z.string().optional(),
  residenteId: z.string().optional(),
  despachadorId: z.string().optional(),
  frenteId: z.string().optional(),
  nombreResidente: nombreOpcional,
  pkResidente: z.string().max(60, 'Máximo 60 caracteres para el PK.').optional(),
  numeroOrquesta: z
    .string()
    .trim()
    .max(40, 'Máximo 40 caracteres para la orquesta.')
    .regex(
      /^[\p{L}\p{N} ._/-]*$/u,
      'Usa letras, números, espacios, punto, guion, guion bajo o barra.',
    )
    .optional(),
  nombreDespachador: nombreOpcional,
  horaCarga: z.iso.time({ precision: -1, error: 'Ingresa una hora válida.' }),
});
