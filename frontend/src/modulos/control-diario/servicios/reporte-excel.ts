import type { OperacionConsolidada, ReporteControl } from '../tipos/consolidado';

export const filaCabeceraExcel = 4;
export const primeraFilaExcel = filaCabeceraExcel + 1;

export const columnasExcel = [
  { clave: 'fecha', titulo: 'Fecha', ancho: 13 },
  { clave: 'economico', titulo: 'N° económico', ancho: 15 },
  { clave: 'maquinaria', titulo: 'Maquinaria', ancho: 20 },
  { clave: 'operador', titulo: 'Operador', ancho: 25 },
  { clave: 'residentePk', titulo: 'Residente / PK', ancho: 34 },
  { clave: 'horometroInicial', titulo: 'Horómetro inicial', ancho: 17 },
  { clave: 'horometroFinal', titulo: 'Horómetro final', ancho: 17 },
  { clave: 'horas', titulo: 'Horas trabajadas', ancho: 16 },
  { clave: 'litros', titulo: 'Litros consumidos', ancho: 17 },
  { clave: 'rendimiento', titulo: 'Rendimiento (L/h)', ancho: 19 },
  { clave: 'alerta', titulo: 'Alerta', ancho: 14 },
] as const;

export type ColumnaExcel = (typeof columnasExcel)[number]['clave'];
export const indiceExcel = (clave: ColumnaExcel) =>
  columnasExcel.findIndex((columna) => columna.clave === clave) + 1;

export const formatosExcel: Partial<Record<ColumnaExcel, string>> = {
  fecha: 'dd/mm/yyyy',
  horometroInicial: '#,##0.00" h"',
  horometroFinal: '#,##0.00" h"',
  horas: '#,##0.00" h"',
  litros: '#,##0.00" L"',
  rendimiento: '0.000" L/h"',
};

export const encabezadosExcel = columnasExcel.map((columna) => columna.titulo);

export function residenteUbicacionExcel(registro: OperacionConsolidada): string {
  if (registro.residente === 'Sin registrar' && registro.pkUbicacion === 'Sin registrar')
    return 'Sin registrar';
  return `${registro.residente || 'Sin registrar'}\n${registro.pkUbicacion || 'Sin registrar'}`;
}

export const valoresOperacionExcel = (registro: OperacionConsolidada) => {
  const lecturas = registro.lecturasHorometro ?? [];
  const valores: Record<ColumnaExcel, string | number | null> = {
    fecha: registro.fecha,
    economico: registro.numeroEconomico,
    maquinaria: registro.maquinaria,
    operador: registro.operador || 'Sin registrar',
    residentePk: residenteUbicacionExcel(registro),
    horometroInicial: lecturas[0]?.inicial ?? null,
    horometroFinal: lecturas.at(-1)?.final ?? null,
    horas: registro.horas,
    litros: registro.litros,
    rendimiento: registro.litrosHora,
    alerta: registro.evaluacion?.nivel ?? 'Sin evaluar',
  };
  return columnasExcel.map(({ clave }) => valores[clave]);
};

export const valoresTotalesExcel = (reporte: ReporteControl) => {
  const valores: Partial<Record<ColumnaExcel, string | number | null>> = {
    fecha: 'TOTAL GENERAL',
    horas: reporte.totales.horas,
    litros: reporte.totales.litros,
    rendimiento: reporte.totales.litrosHora,
  };
  return columnasExcel.map(({ clave }) => (clave in valores ? valores[clave]! : ''));
};
