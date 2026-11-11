import { describe, expect, it } from 'vitest';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { consolidarControlDiario } from './consolidacion';
import { calcularRendimientos } from '../../../compartido/utilidades/calculos';
import { filtrarControlDiario, filtrosVacios } from '../utilidades/filtros-control';
import { totalizarControl, totalesPorMaquinaria } from '../utilidades/totales-control';
import { validarRegistro } from '../../../compartido/servicios/reglas-negocio';
function preparar() {
  const base = crearDemostracion();
  base.horometros = [base.horometros[0]];
  base.combustible = [base.combustible[0]];
  base['control-diario'] = [];
  return base;
}
describe('Consolidación automática', () => {
  it('crea filas completas y parciales sin necesitar una operación manual', () => {
    const base = preparar();
    let filas = consolidarControlDiario(base);
    expect(filas).toHaveLength(1);
    expect(filas[0].litrosHora).toBe(95 / 8);
    expect(filas[0].horasLitro).toBe(8 / 95);
    expect(filas[0].pendientes).toEqual([]);
    base.combustible = [];
    filas = consolidarControlDiario(base);
    expect(filas[0].horas).toBe(8);
    expect(filas[0].litros).toBeNull();
    expect(filas[0].litrosHora).toBeNull();
    expect(filas[0].pendientes).toContain('Falta combustible');
    base.combustible = [crearDemostracion().combustible[0]];
    base.horometros = [];
    filas = consolidarControlDiario(base);
    expect(filas[0].horas).toBeNull();
    expect(filas[0].litros).toBe(95);
  });
  it('suma varias lecturas y cargas independientemente, sin producto cartesiano', () => {
    const base = preparar();
    const lectura = base.horometros[0];
    base.horometros = [
      { ...lectura, lecturaInicial: 100, lecturaFinal: 104 },
      { ...lectura, id: 'segundo-turno', lecturaInicial: 104, lecturaFinal: 110 },
    ];
    base.combustible = [
      { ...base.combustible[0], litrosCargados: 30 },
      { ...base.combustible[0], id: 'segunda-carga', litrosCargados: 50 },
    ];
    const [fila] = consolidarControlDiario(base);
    expect(fila.horas).toBe(10);
    expect(fila.litros).toBe(80);
    expect(fila.litrosHora).toBe(8);
    expect(fila.horasLitro).toBe(0.125);
  });
  it('mantiene el identificador ante edición, eliminación parcial y cambio de número económico', () => {
    const base = preparar();
    const original = consolidarControlDiario(base)[0];
    base.combustible[0].litrosCargados = 40;
    base.horometros[0].lecturaFinal += 2;
    base.maquinarias[0].numeroEconomico = 'NUEVO-001';
    const [editado] = consolidarControlDiario(base);
    expect(editado.id).toBe(original.id);
    expect(editado.horas).toBe(10);
    expect(editado.litros).toBe(40);
    base.combustible[0].eliminado = true;
    const [parcial] = consolidarControlDiario(base);
    expect(parcial.id).toBe(original.id);
    expect(parcial.litros).toBeNull();
    base.horometros[0].eliminado = true;
    expect(consolidarControlDiario(base)).toHaveLength(0);
  });
  it('conserva los operadores de las fuentes e ignora actividades y conserva los datos antiguos sin generar filas', () => {
    const base = preparar();
    base['control-diario'] = [
      {
        ...crearDemostracion()['control-diario'][0],
        actividad: 'Frente manual antiguo',
        operador: 'Operador antiguo',
      },
    ];
    expect(consolidarControlDiario(base)[0]).not.toHaveProperty('actividad');
    expect(consolidarControlDiario(base)[0].operador).not.toBe('Operador antiguo');
    base.horometros[0].actividad = 'Frente fuente';
    base.combustible[0].actividad = 'Frente fuente';
    base.horometros[0].operador = 'Ana fuente';
    base.combustible[0].operador = 'Luis fuente';
    let filas = consolidarControlDiario(base);
    expect(filas).toHaveLength(1);
    expect(filas[0]).not.toHaveProperty('actividad');
    expect(filas[0].operador).toBe('Ana fuente / Luis fuente');
    base.horometros[0].fecha = '2020-01-01';
    base.horometros[0].fechaAsignacion = '2020-01-01';
    filas = consolidarControlDiario(base);
    expect(filas).toHaveLength(2);
    base.horometros[0].eliminado = true;
    base.combustible[0].eliminado = true;
    expect(consolidarControlDiario(base)).toHaveLength(0);
    expect(base['control-diario'][0].actividad).toBe('Frente manual antiguo');
  });
  it('no muestra rendimientos ante ceros, negativos, no finitos o lecturas solapadas', () => {
    for (const [horas, litros] of [
      [0, 10],
      [-1, 10],
      [10, -1],
      [NaN, 10],
      [10, Infinity],
    ])
      expect(calcularRendimientos(horas, litros).litrosHora).toBeNull();
    const base = preparar();
    base.horometros.push({ ...base.horometros[0], id: 'solapada' });
    expect(consolidarControlDiario(base)[0].horas).toBeNull();
    base.horometros.pop();
    base.combustible[0].litrosCargados = -5;
    expect(consolidarControlDiario(base)[0].litros).toBeNull();
  });
  it('permite múltiples intervalos sin superposición y limita el total diario a 24 horas', () => {
    const base = preparar();
    const lectura = base.horometros[0];
    expect(() =>
      validarRegistro(
        'horometros',
        {
          ...lectura,
          lecturaInicial: lectura.lecturaFinal,
          lecturaFinal: lectura.lecturaFinal + 4,
        },
        undefined,
        base,
      ),
    ).not.toThrow();
    expect(() =>
      validarRegistro(
        'horometros',
        {
          ...lectura,
          lecturaInicial: lectura.lecturaFinal,
          lecturaFinal: lectura.lecturaFinal + 20,
        },
        undefined,
        base,
      ),
    ).toThrow('24 horas');
  });
});
describe('Filtros y totales del control', () => {
  it('combina fechas, ID, operador y búsqueda ignorando acentos', () => {
    const base = crearDemostracion();
    base.horometros[0].actividad = 'Excavación · Frente norte';
    const filas = consolidarControlDiario(base);
    const fecha = base.horometros[0].fecha;
    const filtradas = filtrarControlDiario(filas, {
      ...filtrosVacios,
      desde: fecha,
      hasta: fecha,
      maquinaria: 'maq-1',
      operador: 'jose',
      busqueda: 'EXC-001',
    });
    expect(filtradas).toHaveLength(1);
    expect(
      filtrarControlDiario(filas, { ...filtrosVacios, busqueda: 'Frente norte' }),
    ).toHaveLength(0);
    expect(filtrarControlDiario(filas, { ...filtrosVacios, operador: 'no existe' })).toHaveLength(
      0,
    );
    expect(
      filtrarControlDiario(filas, { ...filtrosVacios, desde: '2099-01-01', hasta: '2020-01-01' }),
    ).toHaveLength(0);
  });
  it('totaliza por periodo y maquinaria sin promediar cocientes ni extrapolar fuentes parciales', () => {
    const base = preparar();
    const fila = consolidarControlDiario(base)[0];
    const filas = [fila, { ...fila, id: 'otro-dia', fecha: '2020-01-01', horas: 2, litros: 5 }];
    const totales = totalizarControl(filas);
    expect(totales.horas).toBe(10);
    expect(totales.litros).toBe(100);
    expect(totales.litrosHora).toBe(10);
    expect(totalesPorMaquinaria(filas)).toHaveLength(1);
    filas[1].horas = null;
    expect(totalizarControl(filas).litrosHora).toBe(95 / 8);
    expect(totalizarControl(filas).parciales).toBe(1);
  });
});
