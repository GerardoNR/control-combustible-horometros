import { describe, expect, it, vi } from 'vitest';
import { fechasDelPeriodo, filtrosDeHoy } from './filtros-control';
describe('Periodos locales de Control Diario', () => {
  it('inicia y limpia con el día local del dispositivo, sin convertir a UTC', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 7, 23, 59));
      expect(filtrosDeHoy()).toEqual({
        busqueda: '',
        maquinaria: '',
        operador: '',
        desde: '2026-11-07',
        hasta: '2026-11-07',
      });
    } finally {
      vi.useRealTimers();
    }
  });
  it('incluye hoy en siete días, cruza meses y calcula el inicio del mes', () => {
    const ahora = new Date(2026, 2, 2, 0, 5);
    expect(fechasDelPeriodo('Últimos 7 días', ahora)).toEqual({
      desde: '2026-02-24',
      hasta: '2026-03-02',
    });
    expect(fechasDelPeriodo('Este mes', ahora)).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-02',
    });
    expect(fechasDelPeriodo('Todas las fechas', ahora)).toEqual({ desde: '', hasta: '' });
  });
});
