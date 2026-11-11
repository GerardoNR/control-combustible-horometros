import { describe, expect, it } from 'vitest';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { consolidarControlDiario } from './consolidacion';
import { crearIndicadoresMaquinaria } from './indicadores-maquinaria';
import { filtrarControlDiario, filtrosVacios } from '../utilidades/filtros-control';

function prepararBase() {
  const base = crearDemostracion();
  const maquinaria = base.maquinarias[0];
  maquinaria.horometroBase = 100;
  maquinaria.consumoNormalMaximo = 20;
  maquinaria.consumoAdvertenciaMaximo = 30;
  maquinaria.referenciaConsumo = 'Prueba operativa validada';
  maquinaria.validadoConsumoPor = 'Supervisión de flota';
  maquinaria.fechaValidacionConsumo = '2026-11-01';
  const horometro = base.horometros[0];
  const combustible = base.combustible[0];
  base.horometros = [
    {
      ...horometro,
      id: 'lectura-prueba',
      fecha: '2026-11-09',
      lecturaInicial: 100,
      lecturaFinal: 102,
    },
  ];
  base.combustible = [
    { ...combustible, id: 'carga-prueba', fecha: '2026-11-09', litrosCargados: 40 },
  ];
  base.maquinarias = [maquinaria, { ...base.maquinarias[1], estado: 'Operativa' }];
  return base;
}

describe('Indicadores por maquinaria', () => {
  it('no clasifica actividad con una jornada ausente o incompatible', () => {
    const base = prepararBase();
    const registros = consolidarControlDiario(base);
    for (const umbral of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(crearIndicadoresMaquinaria(base, registros, filtrosVacios, umbral)[0].actividad).toBe(
        'Sin datos suficientes',
      );
    }
    expect(crearIndicadoresMaquinaria(base, registros, filtrosVacios, 2)[0].actividad).toBe(
      'Normal',
    );
  });
  it('separa actividad baja y falta de registros, y evalúa el rendimiento con límites del equipo', () => {
    const base = prepararBase();
    const registros = filtrarControlDiario(consolidarControlDiario(base), {
      ...filtrosVacios,
      desde: '2026-11-09',
      hasta: '2026-11-09',
    });
    const indicadores = crearIndicadoresMaquinaria(base, registros, filtrosVacios, 8);
    expect(indicadores[0]).toMatchObject({
      horas: 2,
      litros: 40,
      rendimiento: 20,
      consumo: 'Bueno',
      actividad: 'Pocas horas',
    });
    expect(indicadores[1]).toMatchObject({
      horas: null,
      rendimiento: null,
      consumo: 'Sin evaluar',
      actividad: 'Sin registros',
    });
  });
  it('aplica los filtros de operador y omite la poca actividad para equipos no operativos', () => {
    const base = prepararBase();
    base.maquinarias[0].estado = 'En mantenimiento';
    const registros = consolidarControlDiario(base).map((registro) => ({
      ...registro,
      operador: 'Operador filtrado',
    }));
    const indicadores = crearIndicadoresMaquinaria(
      base,
      registros,
      { ...filtrosVacios, operador: 'Operador filtrado' },
      8,
    );
    expect(indicadores[0].actividad).toBe('No aplica');
    expect(indicadores).toHaveLength(1);
  });
  it('clasifica el consumo relativo al límite normal sin compartir límites entre equipos', () => {
    const base = prepararBase();
    const registro = consolidarControlDiario(base)[0];
    const alto = { ...registro, litros: 62, horas: 2 };
    const indicadores = crearIndicadoresMaquinaria(base, [alto], filtrosVacios);
    expect(indicadores[0].consumo).toBe('Malo');
    expect(indicadores[0].desviacionConsumo).toBeGreaterThan(1);
    expect(indicadores[1].consumo).toBe('Sin evaluar');
  });
  it('incluye jornadas de cero horas y no clasifica como normal un periodo con horas incompletas', () => {
    const base = prepararBase();
    const registro = consolidarControlDiario(base)[0];
    const jornadaCero = { ...registro, id: 'dia-cero', fecha: '2026-11-08', horas: 0 };
    expect(
      crearIndicadoresMaquinaria(base, [registro, jornadaCero], filtrosVacios, 2)[0],
    ).toMatchObject({ actividad: 'Pocas horas', diasOperativos: 2 });
    expect(
      crearIndicadoresMaquinaria(
        base,
        [registro, { ...jornadaCero, horas: null }],
        filtrosVacios,
        2,
      )[0].actividad,
    ).toBe('Sin datos suficientes');
  });
});
