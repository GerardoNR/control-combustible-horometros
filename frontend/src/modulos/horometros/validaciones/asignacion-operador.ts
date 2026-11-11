import { normalizarOperador } from '../utilidades/operadores';
import { z } from 'zod';
import { texto } from '../../../compartido/validaciones/campos';
const instante = z.iso
  .datetime({ offset: true, error: 'Ingresa una fecha y hora válidas.' })
  .refine(
    (valor) => Number(valor.slice(0, 4)) >= 2000 && Number(valor.slice(0, 4)) <= 2100,
    'La fecha debe estar entre 2000 y 2100.',
  );
export const esquemaCambioOperador = z.object({
  maquinariaId: texto,
  operadorNuevo: texto,
  operadorId: z.string().optional(),
  inicio: instante,
  motivo: texto,
  asignacionAnteriorId: z.string().min(1).nullable(),
});
export const esquemaFormularioCambio = z.object({
  operadorNuevo: texto,
  inicioLocal: z.iso.date('Ingresa una fecha válida.').refine(
    (valor) => valor >= '2000-01-01' && valor <= '2100-12-31',
    'La fecha debe estar entre 2000 y 2100.',
  ),
  motivo: texto,
});
export const esquemaAsignacionOperador = z
  .object({
    id: texto,
    maquinariaId: texto,
    operador: texto,
    operadorId: z.string().optional(),
    inicio: instante,
    fin: instante.nullable(),
    asignacionAnteriorId: z.string().min(1).nullable(),
    motivo: texto,
    registradoEn: instante,
    usuarioResponsableId: texto,
    usuarioResponsableNombre: texto,
    cierre: z
      .object({
        motivo: texto,
        registradoEn: instante,
        usuarioResponsableId: texto,
        usuarioResponsableNombre: texto,
      })
      .optional(),
  })
  .refine(
    (asignacion) =>
      asignacion.fin === null || Date.parse(asignacion.fin) > Date.parse(asignacion.inicio),
    { path: ['fin'], message: 'El fin debe ser posterior al inicio.' },
  )
  .refine((asignacion) => (asignacion.fin === null ? !asignacion.cierre : !!asignacion.cierre), {
    path: ['cierre'],
    message: 'El cierre debe corresponder al fin de la asignación.',
  });
export const esquemaAsignacionesOperadores = z
  .array(esquemaAsignacionOperador)
  .superRefine((asignaciones, contexto) => {
    const ids = new Set<string>();
    asignaciones.forEach((asignacion, indice) => {
      if (ids.has(asignacion.id))
        contexto.addIssue({
          code: 'custom',
          path: [indice, 'id'],
          message: 'El ID de asignación está duplicado.',
        });
      ids.add(asignacion.id);
      if (asignacion.asignacionAnteriorId) {
        const anterior = asignaciones.find(
          (registro) => registro.id === asignacion.asignacionAnteriorId,
        );
        if (
          !anterior ||
          anterior.maquinariaId !== asignacion.maquinariaId ||
          anterior.fin === null ||
          Date.parse(anterior.fin) > Date.parse(asignacion.inicio)
        )
          contexto.addIssue({
            code: 'custom',
            path: [indice, 'asignacionAnteriorId'],
            message: 'La referencia al periodo anterior no es consistente.',
          });
      }
    });
    for (const campo of ['maquinariaId', 'operador'] as const) {
      const grupos = new Map<string, { indice: number; inicio: number; fin: number }[]>();
      asignaciones.forEach((asignacion, indice) => {
        const clave =
          campo === 'operador' ? normalizarOperador(asignacion.operador) : asignacion.maquinariaId;
        const grupo = grupos.get(clave) ?? [];
        grupo.push({
          indice,
          inicio: Date.parse(asignacion.inicio),
          fin: asignacion.fin === null ? Infinity : Date.parse(asignacion.fin),
        });
        grupos.set(clave, grupo);
      });
      grupos.forEach((grupo) => {
        grupo.sort((a, b) => a.inicio - b.inicio);
        grupo.forEach((periodo, indice) => {
          if (indice > 0 && grupo[indice - 1].fin > periodo.inicio)
            contexto.addIssue({
              code: 'custom',
              path: [periodo.indice, 'inicio'],
              message: `Hay periodos incompatibles para ${campo === 'operador' ? 'el operador' : 'la maquinaria'}.`,
            });
        });
      });
    }
  });
