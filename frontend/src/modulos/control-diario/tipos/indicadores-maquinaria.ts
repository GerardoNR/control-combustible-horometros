import type { EstadoConsumo } from '../servicios/evaluacion-consumo';
export type EstadoMantenimientoIndicador =
  | 'Verde'
  | 'Amarillo'
  | 'Rojo'
  | 'Avance pendiente de verificar'
  | 'Sin referencia'
  | 'Revisar horómetro';
export type NivelActividad =
  'Normal' | 'Pocas horas' | 'Sin registros' | 'Sin datos suficientes' | 'No aplica';
export interface IndicadorMaquinaria {
  maquinariaId: string;
  numeroEconomico: string;
  maquinaria: string;
  estadoOperativo: string;
  mantenimiento: EstadoMantenimientoIndicador;
  horas: number | null;
  litros: number | null;
  rendimiento: number | null;
  consumo: EstadoConsumo;
  actividad: NivelActividad;
  desviacionConsumo: number | null;
  diasOperativos: number;
}
