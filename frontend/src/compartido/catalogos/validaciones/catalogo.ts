import { z } from 'zod';
import { texto } from '../../validaciones/campos';
import { esquemaMaquinaria } from '../../../modulos/maquinarias/validaciones/maquinaria';
export const tiposCatalogo = [
  'operadores',
  'residentes',
  'despachadores',
  'frentes',
  'tiposMaquinaria',
  'marcas',
  'modelos',
  'ubicaciones',
  'combustibles',
] as const;
export const esquemaEntradaCatalogo = z.object({
  tipo: z.enum(tiposCatalogo),
  codigo: texto
    .regex(/^[\p{L}\p{N}._/-]+$/u, 'Usa un identificador sin espacios.')
    .transform((valor) => valor.toUpperCase()),
  nombre: texto,
  pk: z.string().max(60).optional(),
  activo: z.boolean(),
});
export const esquemaCargaCatalogos = z
  .object({
    maquinarias: z.array(esquemaMaquinaria).max(1000),
    entradas: z.array(esquemaEntradaCatalogo).max(1000),
    reemplazar: z.boolean(),
    importacion: z
      .object({ huella: z.string().regex(/^[a-f0-9]{64}$/), nombreArchivo: texto })
      .optional(),
  })
  .refine(
    (datos) => datos.maquinarias.length + datos.entradas.length > 0,
    'No hay registros para guardar.',
  );
