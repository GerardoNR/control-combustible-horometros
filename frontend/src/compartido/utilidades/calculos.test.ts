import { describe, expect, it } from 'vitest';
import { crearDemostracion } from '../../../pruebas/datos/operaciones-legadas';
import { horasTrabajadas, resumenDiario, ultimoHorometro } from './calculos';
import { hoy } from './formato';
describe('Cálculos operativos', () => {
  it('calcula las horas con decimales sin residuos de punto flotante', () => {
    expect(horasTrabajadas({ lecturaInicial: 100.1, lecturaFinal: 108.3 })).toBe(8.2);
  });
  it('obtiene la última lectura sin depender del orden de los registros', () => {
    const base = crearDemostracion();
    expect(ultimoHorometro(base.maquinarias[0], base.horometros)).toBe(2480);
    expect(ultimoHorometro(base.maquinarias[2], base.horometros)).toBe(4210);
  });
  it('vincula solo horas y litros del mismo equipo y día, sumando varias cargas', () => {
    const base = crearDemostracion();
    base.combustible.push({ ...base.combustible[0], id: 'otra-carga', litrosCargados: 5 });
    base.combustible.push({
      ...base.combustible[0],
      id: 'otro-dia',
      fecha: '2020-01-01',
      litrosCargados: 999,
    });
    const resumen = resumenDiario(base, 'maq-1', hoy());
    expect(resumen.horas).toBe(8);
    expect(resumen.litros).toBe(100);
    expect(resumen.rendimiento).toBe(0.08);
  });
  it('no inventa rendimiento si faltan fuentes o los litros son cero', () => {
    const base = crearDemostracion();
    expect(resumenDiario(base, 'maq-3', hoy()).rendimiento).toBeNull();
    base.combustible[0].litrosCargados = 0;
    expect(resumenDiario(base, 'maq-1', hoy()).rendimiento).toBeNull();
    base.combustible[0].litrosCargados = 95;
    base.horometros = [];
    expect(resumenDiario(base, 'maq-1', hoy()).rendimiento).toBeNull();
  });
});
