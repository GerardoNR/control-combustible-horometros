import type { z } from 'zod';
import type { esquemaMaquinaria } from '../validaciones/maquinaria';
import type { Auditoria } from '../../../compartido/tipos/datos';
export type DatosMaquinaria = z.infer<typeof esquemaMaquinaria>;
export type Maquinaria = DatosMaquinaria & Auditoria;
