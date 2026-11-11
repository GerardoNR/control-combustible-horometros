import type { z } from 'zod';
import type { esquemaOperacion } from '../validaciones/operacion';
import type { Auditoria } from '../../../compartido/tipos/datos';
export type DatosOperacion = z.infer<typeof esquemaOperacion>;
export type Operacion = DatosOperacion & Auditoria;
