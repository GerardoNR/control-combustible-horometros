import { camposConsumo } from '../../maquinarias/validaciones/consumo';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearMuestraFicticia } from '../../../../pruebas/datos/operaciones-completas';
import { evaluarConsumo } from './evaluacion-consumo';
import { residentesOperacion } from './residentes-operacion';
import { consolidarControlDiario } from './consolidacion';
import {
  RepositorioLocal,
  claveAlmacenamiento,
} from '../../../compartido/servicios/repositorio-local';
import { usuarios } from '../../../../pruebas/datos/usuarios';
import {
  limitesDiaOperativo,
  fechaGeneracionExcel,
  fechaGeneracion,
} from '../utilidades/fechas-reporte';

const configuracion = {
  consumoNormalMaximo: 10,
  consumoAdvertenciaMaximo: 15,
  referenciaConsumo: 'Escenario ficticio para pruebas; no es una referencia técnica oficial.',
  validadoConsumoPor: 'Responsable ficticio',
  fechaValidacionConsumo: '2026-11-01',
};
afterEach(() => vi.unstubAllGlobals());
describe('Consumo por equipo e historial operativo', () => {
  it('clasifica fronteras y permite límites diferentes por equipo sin rangos predeterminados', () => {
    const base = crearMuestraFicticia('2026-11-09');
    const equipo = { ...base.maquinarias[0], ...configuracion };
    expect([10, 10.01, 15, 15.01].map((litros) => evaluarConsumo(1, litros, equipo))).toEqual([
      'Bueno',
      'Medio',
      'Medio',
      'Malo',
    ]);
    expect(
      evaluarConsumo(1, 14, { ...equipo, consumoNormalMaximo: 20, consumoAdvertenciaMaximo: 25 }),
    ).toBe('Bueno');
    for (const [horas, litros] of [
      [null, 10],
      [8, null],
      [0, 10],
      [-1, 10],
      [NaN, 10],
      [8, Infinity],
      [8, -1],
    ])
      expect(evaluarConsumo(horas, litros, equipo)).toBe('Sin evaluar');
    expect(evaluarConsumo(8, 0, equipo)).toBe('Bueno');
    const sinLimites = { ...base.maquinarias[0] };
    for (const campo of camposConsumo) delete sinLimites[campo];
    expect(evaluarConsumo(8, 100, sinLimites)).toBe('Sin evaluar');
    expect(evaluarConsumo(8, 100, { ...equipo, referenciaConsumo: '' })).toBe('Sin evaluar');
    expect(evaluarConsumo(8, 100, { ...equipo, consumoAdvertenciaMaximo: 5 })).toBe('Sin evaluar');
  });
  it('resuelve el residente por fecha operativa y conserva íntegros los periodos históricos', () => {
    const base = crearMuestraFicticia('2026-11-09');
    const equipo = base.maquinarias[0];
    const [anterior, vigente] = equipo.periodosResidentes!;
    equipo.periodosResidentes = [
      { ...anterior, inicio: '2026-11-08T00:00:00-06:00', fin: '2026-11-09T12:00:00-06:00' },
      { ...vigente, inicio: '2026-11-09T12:00:00-06:00' },
    ];
    const antes = structuredClone(equipo.periodosResidentes);
    expect(residentesOperacion(equipo, '2026-11-07').residente).toBe('Sin registrar');
    expect(residentesOperacion(equipo, '2026-11-08')).toEqual({
      residente: anterior.nombre,
      pkUbicacion: anterior.pk,
    });
    expect(residentesOperacion(equipo, '2026-11-09')).toEqual({
      residente: vigente.nombre,
      pkUbicacion: vigente.pk,
    });
    expect(equipo.periodosResidentes).toEqual(antes);
    equipo.periodosResidentes = [{ ...anterior }];
    expect(residentesOperacion(equipo, '2026-11-09').residente).toBe('Sin registrar');
  });
  it('suma varias cargas una vez y mantiene la evaluación separada del mantenimiento', () => {
    const base = crearMuestraFicticia('2026-11-09');
    Object.assign(base.maquinarias[0], configuracion);
    const carga = base.combustible.find(
      (r) => r.maquinariaId === 'prueba-maq-01' && r.fecha === '2026-11-09',
    )!;
    base.combustible.push({ ...carga, id: 'segunda-carga', litrosCargados: 20 });
    const filas = consolidarControlDiario(base).filter(
      (r) => r.maquinariaId === 'prueba-maq-01' && r.fecha === '2026-11-09',
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      horas: 8,
      litros: 120,
      litrosHora: 15,
      estadoConsumo: 'Medio',
    });
    base.maquinarias[0].estado = 'En mantenimiento';
    expect(consolidarControlDiario(base).find((r) => r.id === filas[0].id)?.estadoConsumo).toBe(
      'Medio',
    );
  });
  it('guarda configuración con procedencia e historial y conserva datos previos sin límites', async () => {
    let almacenado: string | null = null;
    vi.stubGlobal('localStorage', {
      getItem: (clave: string) => (clave === claveAlmacenamiento ? almacenado : null),
      setItem: (_clave: string, valor: string) => (almacenado = valor),
    });
    const repositorio = new RepositorioLocal(() => {
      const muestra = crearMuestraFicticia('2026-11-09');
      muestra.maquinarias.forEach((equipo) => {
        for (const campo of camposConsumo) delete equipo[campo];
      });
      return muestra;
    });
    const base = await repositorio.cargar();
    const equipo = base.maquinarias[0];
    await expect(
      repositorio.guardar(
        'maquinarias',
        { ...equipo, ...configuracion },
        equipo.id,
        usuarios[1],
        base,
      ),
    ).rejects.toThrow('Solo el administrador');
    await expect(
      repositorio.guardar(
        'maquinarias',
        { ...equipo, consumoNormalMaximo: 10 },
        equipo.id,
        usuarios[0],
        base,
      ),
    ).rejects.toThrow();
    const guardado = await repositorio.guardar(
      'maquinarias',
      { ...equipo, ...configuracion },
      equipo.id,
      usuarios[0],
      base,
    );
    expect(guardado.historial.at(-1)?.valores.consumoNormalMaximo).toBe(10);
    expect((await repositorio.cargar()).maquinarias[1].consumoNormalMaximo).toBeUndefined();
  });
  it('usa la misma fecha civil de obra en Excel y PDF, independiente de la zona del proceso', () => {
    const fecha = new Date('2026-11-09T18:00:00Z');
    expect(fechaGeneracion(fecha)).toBe('09/11/2026');
    expect(fechaGeneracionExcel(fecha).toISOString()).toBe('2026-11-09T12:00:00.000Z');
    expect(new Date(limitesDiaOperativo('2026-11-09').inicio).toISOString()).toBe(
      '2026-11-09T06:00:00.000Z',
    );
  });
});
