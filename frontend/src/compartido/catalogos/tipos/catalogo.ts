import type { z } from 'zod';
import type { Auditoria } from '../../tipos/datos';
import type { esquemaEntradaCatalogo, esquemaCargaCatalogos } from '../validaciones/catalogo';
export type DatosEntradaCatalogo = z.infer<typeof esquemaEntradaCatalogo>;
export type EntradaCatalogo = DatosEntradaCatalogo & Auditoria;
export type TipoCatalogo = DatosEntradaCatalogo['tipo'];
export type CargaCatalogos = z.infer<typeof esquemaCargaCatalogos>;
export interface ImportacionCatalogos {
  huella: string;
  nombreArchivo: string;
  fecha: string;
  usuarioId: string;
}
export interface FilaImportacion {
  hoja: string;
  fila: number;
  identificador: string;
  nombre: string;
  existente: boolean;
  datos: Record<string, string | number | boolean>;
  errores: string[];
}
export interface VistaImportacion {
  carga: CargaCatalogos;
  filas: FilaImportacion[];
}

export interface ReferenciasFormulario {
  residente?: { nombre: string; pk: string };
  fechaInicioResidente?: string;
}
