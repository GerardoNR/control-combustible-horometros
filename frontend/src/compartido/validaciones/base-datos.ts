import { esquemaMantenimiento } from '../../modulos/maquinarias/validaciones/mantenimiento';
import { esquemaEntradaCatalogo } from '../catalogos/validaciones/catalogo';
import { migrarSuministroAnterior } from '../../modulos/combustible/servicios/migrar-suministro';
import { esquemaAsignacionesOperadores } from '../../modulos/horometros/validaciones/asignacion-operador';
import { z } from 'zod';
import { esquemaMaquinaria } from '../../modulos/maquinarias/validaciones/maquinaria';
import {
  esquemaHorometro,
  esquemaCamposHistoricosHorometro,
} from '../../modulos/horometros/validaciones/horometro';
import { esquemaSuministro } from '../../modulos/combustible/validaciones/suministro';
import { esquemaOperacion } from '../../modulos/control-diario/validaciones/operacion';
export const esquemasDatos = {
  maquinarias: esquemaMaquinaria,
  horometros: esquemaHorometro,
  combustible: esquemaSuministro,
  'control-diario': esquemaOperacion,
};
const valores = z.record(z.string(), z.union([z.string(), z.number()]));
const auditoria = z.object({
  id: z.string(),
  creadoEn: z.iso.datetime({ offset: true }),
  creadoPor: z.string(),
  modificadoEn: z.iso.datetime({ offset: true }),
  modificadoPor: z.string(),
  eliminado: z.boolean().optional(),
  historial: z.array(
    z.object({
      fecha: z.iso.datetime({ offset: true }),
      usuarioId: z.string(),
      usuarioNombre: z.string(),
      accion: z.enum(['Creación', 'Edición', 'Eliminación']),
      valores,
      anteriores: valores.optional(),
    }),
  ),
});
export const esquemasRegistros = {
  maquinarias: esquemaMaquinaria.and(auditoria),
  horometros: esquemaHorometro.and(esquemaCamposHistoricosHorometro).and(auditoria),
  combustible: z.preprocess(migrarSuministroAnterior, esquemaSuministro.and(auditoria)),
  'control-diario': esquemaOperacion.and(auditoria),
};
export const esquemaRegistroMantenimiento = esquemaMantenimiento.and(auditoria);
export const esquemaBase = z.object({
  mantenimientos: z.array(esquemaRegistroMantenimiento).optional(),
  maquinarias: z.array(esquemasRegistros.maquinarias),
  horometros: z.array(esquemasRegistros.horometros),
  combustible: z.array(esquemasRegistros.combustible),
  'control-diario': z.array(esquemasRegistros['control-diario']),
  asignacionesOperadores: esquemaAsignacionesOperadores.optional(),
  catalogos: z.array(esquemaEntradaCatalogo.and(auditoria)).optional(),
  importacionesCatalogos: z
    .array(
      z.object({
        huella: z.string(),
        nombreArchivo: z.string(),
        fecha: z.iso.datetime({ offset: true }),
        usuarioId: z.string(),
      }),
    )
    .optional(),
});
