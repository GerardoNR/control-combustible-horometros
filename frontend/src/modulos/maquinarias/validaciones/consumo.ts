import { z } from 'zod';
import { cantidad, fecha, texto } from '../../../compartido/validaciones/campos';
import { hoy } from '../../../compartido/utilidades/formato';

export const parametrosAdicionalesConsumo = {
  consumoMinimoEsperado: cantidad.optional(),
  consumoAdvertenciaMinimo: cantidad.optional(),
  horasMinimasDiarias: cantidad.positive().max(24).optional(),
  consumoRalentiMinimo: cantidad.optional(),
  consumoRalentiMaximo: cantidad.positive().optional(),
  consumoRalentiAdvertenciaMaximo: cantidad.positive().optional(),
};
const metadatos = {
  referenciaConsumo: texto,
  validadoConsumoPor: texto,
  fechaValidacionConsumo: fecha.refine(
    (valor) => valor <= hoy(),
    'La validación no puede ser futura.',
  ),
};
const campos = {
  consumoNormalMaximo: cantidad.positive('Indica el máximo normal en L/h.'),
  consumoAdvertenciaMaximo: cantidad.positive('Indica el máximo de advertencia en L/h.'),
  ...metadatos,
  ...parametrosAdicionalesConsumo,
};
function validarRangos(datos: z.infer<z.ZodObject<typeof campos>>, contexto: z.RefinementCtx) {
  function error(campo: string, mensaje: string) {
    contexto.addIssue({ code: 'custom', path: [campo], message: mensaje });
  }
  if (datos.consumoAdvertenciaMaximo <= datos.consumoNormalMaximo)
    error('consumoAdvertenciaMaximo', 'El límite de advertencia debe ser mayor al máximo normal.');
  if (
    datos.consumoMinimoEsperado !== undefined &&
    datos.consumoMinimoEsperado > datos.consumoNormalMaximo
  )
    error('consumoMinimoEsperado', 'El mínimo no puede superar el máximo esperado.');
  if (
    datos.consumoAdvertenciaMinimo !== undefined &&
    (datos.consumoMinimoEsperado === undefined ||
      datos.consumoAdvertenciaMinimo > datos.consumoMinimoEsperado)
  )
    error(
      'consumoAdvertenciaMinimo',
      'La advertencia inferior requiere un mínimo esperado y no puede superarlo.',
    );
  if ((datos.consumoRalentiMinimo === undefined) !== (datos.consumoRalentiMaximo === undefined))
    error('consumoRalentiMaximo', 'Completa ambos límites de ralentí o deja ambos vacíos.');
  if (
    datos.consumoRalentiMinimo !== undefined &&
    datos.consumoRalentiMaximo !== undefined &&
    datos.consumoRalentiMinimo > datos.consumoRalentiMaximo
  )
    error('consumoRalentiMinimo', 'El mínimo de ralentí no puede superar su máximo.');
  if (
    datos.consumoRalentiAdvertenciaMaximo !== undefined &&
    (datos.consumoRalentiMaximo === undefined ||
      datos.consumoRalentiAdvertenciaMaximo <= datos.consumoRalentiMaximo)
  )
    error(
      'consumoRalentiAdvertenciaMaximo',
      'La advertencia de ralentí debe superar su máximo esperado.',
    );
}
export const esquemaLimitesConsumo = z.object(campos).superRefine(validarRangos);
export const esquemaConfiguracionConsumo = z
  .object({
    ...campos,
    referenciaConsumo: texto.or(z.literal('')),
    validadoConsumoPor: texto.or(z.literal('')),
    fechaValidacionConsumo: metadatos.fechaValidacionConsumo.or(z.literal('')),
  })
  .partial()
  .superRefine((datos, contexto) => {
    const tieneRango = [
      'consumoNormalMaximo',
      'consumoAdvertenciaMaximo',
      'consumoMinimoEsperado',
      'consumoAdvertenciaMinimo',
      'consumoRalentiMinimo',
      'consumoRalentiMaximo',
      'consumoRalentiAdvertenciaMaximo',
    ].some((campo) => Reflect.get(datos, campo) !== undefined);
    const resultado = tieneRango
      ? esquemaLimitesConsumo.safeParse(datos)
      : datos.horasMinimasDiarias !== undefined
        ? z.object(metadatos).safeParse(datos)
        : null;
    if (resultado && !resultado.success)
      resultado.error.issues.forEach((problema) =>
        contexto.addIssue({ code: 'custom', path: problema.path, message: problema.message }),
      );
  });
export const camposConsumo = Object.keys(campos) as (keyof typeof campos)[];
