import type { FiltrosControl, OperacionConsolidada, ReporteControl } from '../tipos/consolidado';
import type { IndicadorMaquinaria } from '../tipos/indicadores-maquinaria';
import { totalizarControl } from '../utilidades/totales-control';
import { columnasExcel, valoresOperacionExcel } from './reporte-excel';

export const columnasReporte = columnasExcel;
export type ColumnaReporte = (typeof columnasReporte)[number]['clave'];
export const encabezadosReporte = columnasReporte.map((columna) => columna.titulo);

export function fechaReporte(fecha: string) {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

function periodoReporte(registros: OperacionConsolidada[], filtros: FiltrosControl) {
  const fechas = registros.map((registro) => registro.fecha).sort();
  const desde = filtros.desde || fechas[0];
  const hasta = filtros.hasta || fechas.at(-1)!;
  if (desde === hasta) return `Fecha: ${fechaReporte(desde)}`;
  return `Periodo: ${fechaReporte(desde)} al ${fechaReporte(hasta)}`;
}

export const valoresOperacion = (registro: OperacionConsolidada) => {
  const valores = valoresOperacionExcel(registro);
  return Object.fromEntries(
    columnasReporte.map(({ clave }, indice) => [
      clave,
      clave === 'fecha' ? fechaReporte(registro.fecha) : valores[indice],
    ]),
  ) as Record<ColumnaReporte, string | number | null>;
};

export const valoresTotales = ({ totales }: ReporteControl) => ({
  horas: totales.horas,
  litros: totales.litros,
  rendimiento: totales.litrosHora,
});

export function crearReporteControl(
  registros: OperacionConsolidada[],
  filtros: FiltrosControl,
  _maquinariaSeleccionada: string,
  generadoEn = new Date(),
  indicadoresMaquinaria: IndicadorMaquinaria[] = [],
  umbralHorasDiarias?: number,
): ReporteControl {
  if (!registros.length)
    throw new Error(
      'No hay resultados que cumplan los filtros. Ajusta los filtros antes de exportar.',
    );
  return {
    generadoEn,
    periodo: periodoReporte(registros, filtros),
    filtros: '',
    registros: structuredClone(registros),
    indicadoresMaquinaria: structuredClone(indicadoresMaquinaria),
    umbralHorasDiarias,
    totales: totalizarControl(registros),
  };
}
