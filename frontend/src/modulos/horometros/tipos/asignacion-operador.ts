import type { z } from 'zod';
import type {
  esquemaAsignacionOperador,
  esquemaCambioOperador,
  esquemaFormularioCambio,
} from '../validaciones/asignacion-operador';
export type AsignacionOperador = z.infer<typeof esquemaAsignacionOperador>;
export type DatosCambioOperador = z.infer<typeof esquemaCambioOperador>;
export type DatosFormularioCambio = z.infer<typeof esquemaFormularioCambio>;
