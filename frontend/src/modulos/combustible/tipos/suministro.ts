import type { z } from 'zod';
import type { esquemaSuministro } from '../validaciones/suministro';
import type { Auditoria } from '../../../compartido/tipos/datos';
export type DatosSuministro = z.infer<typeof esquemaSuministro>;
export type Suministro = DatosSuministro & Auditoria;
