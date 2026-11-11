import type { z } from 'zod';
import type { esquemaMantenimiento } from '../validaciones/mantenimiento';
import type { Auditoria } from '../../../compartido/tipos/datos';
export type DatosMantenimiento = z.infer<typeof esquemaMantenimiento>;
export type Mantenimiento = DatosMantenimiento & Auditoria;
