import { describe, expect, it } from 'vitest';
import {
  fechaLocal,
  fechaVisible,
  fechaDelInstante,
  validarFechaConsulta,
  periodosDelDia,
} from './fecha-historial';
const instante = (dia: number, hora = 0) => new Date(2026, 10, dia, hora).toISOString();
describe('Consulta por día local', () => {
  it('usa hoy sin horas y lo presenta como DD/MM/AAAA', () => {
    const hoy = new Date(2026, 10, 7, 23, 59, 59);
    expect(fechaLocal(hoy)).toBe('2026-11-07');
    expect(fechaVisible(fechaLocal(hoy))).toBe('07/11/2026');
    expect(fechaDelInstante(hoy.toISOString())).toBe('07/11/2026');
  });
  it('admite hoy y fechas anteriores y rechaza futuros y valores inválidos', () => {
    const hoy = new Date(2026, 10, 7, 0, 1);
    expect(validarFechaConsulta('2026-11-07', hoy)).toBe('2026-11-07');
    expect(validarFechaConsulta('2026-11-06', hoy)).toBe('2026-11-06');
    expect(() => validarFechaConsulta('2026-11-08', hoy)).toThrow('anterior');
    for (const valor of ['', '2026-02-30', '2026-11-07T10:00', '07/11/2026'])
      expect(() => validarFechaConsulta(valor, hoy)).toThrow('válida');
  });
  it('devuelve todos los relevos del día en orden sin cambiar los periodos originales', () => {
    const periodos = [
      { id: 'tercero', inicio: instante(6, 16), fin: null },
      { id: 'primero', inicio: instante(5, 8), fin: instante(6, 8) },
      { id: 'segundo', inicio: instante(6, 8), fin: instante(6, 16) },
    ];
    const original = structuredClone(periodos);
    expect(periodosDelDia(periodos, '2026-11-06').map((p) => p.id)).toEqual([
      'primero',
      'segundo',
      'tercero',
    ]);
    expect(periodos).toEqual(original);
  });
  it('respeta medianoches e intervalos semiabiertos', () => {
    const periodos = [
      { id: 'anterior', inicio: instante(5), fin: instante(6) },
      { id: 'del-dia', inicio: instante(6), fin: instante(7) },
      { id: 'posterior', inicio: instante(7), fin: null },
    ];
    expect(periodosDelDia(periodos, '2026-11-06').map((p) => p.id)).toEqual(['del-dia']);
    expect(periodosDelDia(periodos, '2026-11-04')).toEqual([]);
  });
  it('no desplaza instantes cercanos a medianoche al día UTC', () => {
    const valor = new Date(2026, 10, 6, 23, 55).toISOString();
    expect(fechaDelInstante(valor)).toBe('06/11/2026');
    expect(periodosDelDia([{ inicio: valor, fin: null }], '2026-11-06')).toHaveLength(1);
  });
  it('avanza al siguiente día calendario en cambios de mes y años bisiestos', () => {
    const inicio = new Date(2024, 1, 29, 23, 59).toISOString();
    const fin = new Date(2024, 2, 1, 0, 0).toISOString();
    expect(periodosDelDia([{ inicio, fin }], '2024-02-29')).toHaveLength(1);
    expect(periodosDelDia([{ inicio, fin }], '2024-03-01')).toHaveLength(0);
  });
});
