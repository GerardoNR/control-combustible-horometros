import type { FiltrosControl, OperacionConsolidada } from '../tipos/consolidado';
export const filtrosVacios: FiltrosControl = {
  busqueda: '',
  maquinaria: '',
  desde: '',
  hasta: '',
  operador: '',
};
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');
export const periodoInvalido = (filtros: FiltrosControl) =>
  !!filtros.desde && !!filtros.hasta && filtros.desde > filtros.hasta;
export function filtrarControlDiario(registros: OperacionConsolidada[], filtros: FiltrosControl) {
  if (periodoInvalido(filtros)) return [];
  return registros.filter(
    (registro) =>
      (!filtros.maquinaria || registro.maquinariaId === filtros.maquinaria) &&
      (!filtros.desde || registro.fecha >= filtros.desde) &&
      (!filtros.hasta || registro.fecha <= filtros.hasta) &&
      normalizar(registro.operador).includes(normalizar(filtros.operador)) &&
      normalizar(
        [
          registro.numeroEconomico,
          registro.maquinaria,
          registro.operador,
          registro.residente,
          registro.pkUbicacion,
          ...registro.pendientes,
        ].join(' '),
      ).includes(normalizar(filtros.busqueda)),
  );
}

export function filtrosDeHoy(): FiltrosControl {
  return { ...filtrosVacios, ...fechasDelPeriodo('Hoy') };
}
export type PeriodoRapido = 'Hoy' | 'Últimos 7 días' | 'Este mes' | 'Todas las fechas';
export function fechasDelPeriodo(periodo: PeriodoRapido, ahora = new Date()) {
  if (periodo === 'Todas las fechas') return { desde: '', hasta: '' };
  const fechaLocal = (fecha: Date) =>
    `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  const inicio = new Date(ahora);
  if (periodo === 'Últimos 7 días') inicio.setDate(inicio.getDate() - 6);
  if (periodo === 'Este mes') inicio.setDate(1);
  return { desde: fechaLocal(inicio), hasta: fechaLocal(ahora) };
}
