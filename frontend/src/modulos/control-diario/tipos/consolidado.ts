import type { EvaluacionMaquinaria } from '../servicios/alertas-maquinaria';
import type { EstadoConsumo } from '../servicios/evaluacion-consumo';
import type { Operacion } from './operacion';
import type { IndicadorMaquinaria } from './indicadores-maquinaria';
export interface OperacionConsolidada extends Omit<Operacion, 'actividad'> {
  regimenConsumo?: string;
  evaluacion?: EvaluacionMaquinaria;
  lecturasHorometro?: { inicial: number; final: number }[];
  residente: string;
  pkUbicacion: string;
  estadoConsumo: EstadoConsumo;
  numeroEconomico: string;
  maquinaria: string;
  horas: number | null;
  litros: number | null;
  litrosHora: number | null;
  horasLitro: number | null;
  pendientes: string[];
}
export interface TotalesControl {
  registros: number;
  parciales: number;
  horas: number;
  litros: number;
  litrosHora: number | null;
  horasLitro: number | null;
}
export interface FiltrosControl {
  busqueda: string;
  maquinaria: string;
  desde: string;
  hasta: string;
  operador: string;
}
export interface ReporteControl {
  generadoEn: Date;
  periodo: string;
  filtros: string;
  registros: OperacionConsolidada[];
  indicadoresMaquinaria: IndicadorMaquinaria[];
  umbralHorasDiarias?: number;
  totales: TotalesControl;
}
