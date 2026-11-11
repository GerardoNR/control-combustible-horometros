import {
  esquemaConfiguracionConsumo,
  camposConsumo,
  parametrosAdicionalesConsumo,
} from './consumo';
import { z } from 'zod';
import { esquemaPeriodosResidentes } from './periodo-residente';
import { cantidad, texto, fecha } from '../../../compartido/validaciones/campos';
import { hoy } from '../../../compartido/utilidades/formato';
const fechaOpcional = fecha.or(z.literal('')).optional();
export const esquemaMaquinaria = z
  .object({
    numeroEconomico: texto
      .regex(/^[A-Za-z0-9-]+$/, 'Usa letras, números o guiones.')
      .transform((valor) => valor.toUpperCase()),
    placas: texto.transform((valor) => valor.toUpperCase()),
    tipo: texto,
    tipoId: z.string().optional(),
    marcaId: z.string().optional(),
    modeloId: z.string().optional(),
    marca: texto,
    modelo: texto,
    estado: z.enum(['Operativa', 'En mantenimiento', 'Fuera de servicio']),
    horometroBase: cantidad,
    ...parametrosAdicionalesConsumo,
    consumoNormalMaximo: cantidad.optional(),
    consumoAdvertenciaMaximo: cantidad.optional(),
    referenciaConsumo: z.string().optional(),
    validadoConsumoPor: z.string().optional(),
    fechaValidacionConsumo: z.string().optional(),
    residenteId: z.string().optional(),
    ubicacionResidente: z.string().max(60).optional(),
    ubicacionResidenteId: z.string().optional(),
    motivoCambioResidente: z.string().trim().max(120).optional(),
    periodosResidentes: esquemaPeriodosResidentes.optional(),
    avisoMantenimientoHoras: cantidad.positive().optional(),
    limiteMantenimientoHoras: cantidad.positive().optional(),
    fechaUltimoMantenimiento: fechaOpcional,
    fechaProximoMantenimiento: fechaOpcional,
    observacionesMantenimiento: z.string().trim().max(500, 'Máximo 500 caracteres.').optional(),
  })
  .superRefine((datos, contexto) => {
    if (camposConsumo.some((campo) => datos[campo] !== undefined)) {
      const resultado = esquemaConfiguracionConsumo.safeParse(datos);
      if (!resultado.success)
        resultado.error.issues.forEach((problema) =>
          contexto.addIssue({ code: 'custom', path: problema.path, message: problema.message }),
        );
    }
    if ((datos.avisoMantenimientoHoras ?? 200) > (datos.limiteMantenimientoHoras ?? 250))
      contexto.addIssue({
        code: 'custom',
        path: ['limiteMantenimientoHoras'],
        message: 'El límite debe ser mayor o igual al aviso.',
      });
    if (datos.fechaUltimoMantenimiento && datos.fechaUltimoMantenimiento > hoy())
      contexto.addIssue({
        code: 'custom',
        path: ['fechaUltimoMantenimiento'],
        message: 'El último mantenimiento no puede estar en el futuro.',
      });
    if (
      datos.fechaUltimoMantenimiento &&
      datos.fechaProximoMantenimiento &&
      datos.fechaProximoMantenimiento <= datos.fechaUltimoMantenimiento
    )
      contexto.addIssue({
        code: 'custom',
        path: ['fechaProximoMantenimiento'],
        message: 'La fecha próxima debe ser posterior al último mantenimiento.',
      });
  });
