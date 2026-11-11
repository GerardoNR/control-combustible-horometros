import type { z } from 'zod';
import type { esquemaHorometro, esquemaCamposHistoricosHorometro } from '../validaciones/horometro';
import type { Auditoria } from '../../../compartido/tipos/datos';
export type DatosHorometro = z.infer<typeof esquemaHorometro>;
export type Horometro = DatosHorometro &
  z.infer<typeof esquemaCamposHistoricosHorometro> &
  Auditoria;
