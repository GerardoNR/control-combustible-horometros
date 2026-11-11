import { z } from 'zod';
import { cantidad, fecha, texto } from '../../../compartido/validaciones/campos';
// Campos anteriores: se conservan al leer registros, sin admitir nuevas capturas.
export const esquemaCamposHistoricosHorometro = z.object({
  actividad: z.string().optional(),
  frenteId: z.string().optional(),
  horaAsignacion: z.string().optional(),
});
export const esquemaHorometro = z
  .object({
    fecha,
    maquinariaId: texto,
  regimenOperacion: z.enum(['Trabajo', 'Ralentí', 'Mixto', '']).optional(),
    lecturaInicial: cantidad,
    lecturaFinal: cantidad,
    fechaAsignacion: fecha.or(z.literal('')),
    operador: texto,
    operadorId: z.string().optional(),
    asignacionId: z.string().optional(),
    capturaInicialSupervisada: z.enum(['Confirmada por administrador']).optional(),
  })
  .refine((datos) => datos.lecturaFinal >= datos.lecturaInicial, {
    message: 'La lectura final debe ser mayor o igual a la inicial.',
    path: ['lecturaFinal'],
  })
  .refine((datos) => datos.lecturaFinal - datos.lecturaInicial <= 24, {
    message: 'Un registro diario no puede superar 24 horas.',
    path: ['lecturaFinal'],
  })
  .refine((datos) => !datos.fechaAsignacion || datos.fechaAsignacion <= datos.fecha, {
    message: 'La asignación no puede ser posterior al registro.',
    path: ['fechaAsignacion'],
  });
