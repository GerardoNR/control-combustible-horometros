import { expect, it } from 'vitest';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { consolidarControlDiario } from '../servicios/consolidacion';
import { totalizarControl } from './totales-control';
it('usa únicamente pares correspondientes para el consumo sin perder las sumas parciales', () => {
  const fila = consolidarControlDiario(crearDemostracion())[0];
  const registros = [
    { ...fila, horas: 2, litros: 80 },
    { ...fila, horas: 8, litros: 20 },
    { ...fila, horas: null, litros: 900 },
    { ...fila, horas: 30, litros: null },
  ];
  expect(totalizarControl(registros)).toEqual({
    registros: 4,
    parciales: 2,
    horas: 40,
    litros: 1000,
    litrosHora: 10,
    horasLitro: 0.1,
  });
});
it('deja el rendimiento pendiente sin pares positivos válidos y evita divisiones por cero', () => {
  const fila = consolidarControlDiario(crearDemostracion())[0];
  for (const registros of [
    [],
    [{ ...fila, horas: 0, litros: 80 }],
    [{ ...fila, horas: null, litros: 80 }],
  ]) {
    expect(totalizarControl(registros).litrosHora).toBeNull();
    expect(totalizarControl(registros).horasLitro).toBeNull();
  }
});

it('calcula cero L/h con una carga válida de cero litros, sin dividir horas entre cero', () => {
  const fila = consolidarControlDiario(crearDemostracion())[0];
  expect(totalizarControl([{ ...fila, horas: 8, litros: 0 }])).toMatchObject({
    litrosHora: 0,
    horasLitro: null,
  });
});
