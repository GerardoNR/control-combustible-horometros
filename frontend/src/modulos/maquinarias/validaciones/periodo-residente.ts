import { z } from 'zod';
import { texto } from '../../../compartido/validaciones/campos';
const instante = z.iso.datetime({ offset: true });
const responsable = z.object({
  motivo: texto,
  registradoEn: instante,
  usuarioId: texto,
  usuarioNombre: texto,
});
export const esquemaPeriodoResidente = responsable
  .extend({
    id: texto,
    residenteId: texto,
    nombre: texto,
    pk: z.string().max(60),
    ubicacionId: z.string().optional(),
    inicio: instante,
    fin: instante.nullable(),
    cierre: responsable.optional(),
  })
  .refine(
    (p) => (p.fin === null ? !p.cierre : !!p.cierre && Date.parse(p.fin) > Date.parse(p.inicio)),
    'Periodo de residente inválido.',
  );
export const esquemaPeriodosResidentes = z
  .array(esquemaPeriodoResidente)
  .superRefine((periodos, contexto) => {
    const ordenados = [...periodos].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
    const ids = new Set<string>();
    ordenados.forEach((periodo, indice) => {
      if (
        ids.has(periodo.id) ||
        (indice > 0 &&
          (ordenados[indice - 1].fin === null ||
            Date.parse(ordenados[indice - 1].fin!) > Date.parse(periodo.inicio)))
      )
        contexto.addIssue({
          code: 'custom',
          message: 'Hay periodos de residentes duplicados o superpuestos.',
        });
      ids.add(periodo.id);
    });
  });
