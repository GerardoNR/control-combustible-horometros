import { describe, expect, it } from 'vitest';
import { crearDemostracion } from '../../../pruebas/datos/operaciones-legadas';
import { lecturaAnterior, asignacionParaFecha, validarCapturaInicial } from './captura-diaria';
import { aplicarCambioOperador } from '../../modulos/horometros/servicios/asignaciones-operadores';
import { usuarios } from '../../../pruebas/datos/usuarios';
import { validarRegistro } from './reglas-negocio';
const fecha = '2026-01-03';
describe('Captura diaria asistida', () => {
  it('selecciona lecturas por equipo y fecha, ignora futuros y eliminados', () => {
    const base = crearDemostracion();
    const lectura = base.horometros[0];
    base.horometros = [
      { ...lectura, id: 'previa', fecha: '2026-01-01', lecturaFinal: 2480 },
      { ...lectura, id: 'futura', fecha: '2026-01-05', lecturaFinal: 2490 },
      { ...lectura, id: 'eliminada', fecha: '2026-01-02', lecturaFinal: 2485, eliminado: true },
    ];
    expect(lecturaAnterior(base, 'maq-1', fecha)?.id).toBe('previa');
    expect(lecturaAnterior(base, 'maq-2', fecha)).toBeUndefined();
  });
  it('requiere supervisión administrativa solo para primera lectura y no al editar', () => {
    const base = crearDemostracion();
    const datos = { maquinariaId: 'maq-7', fecha };
    expect(() => validarCapturaInicial(base, datos, 'CAPTURISTA')).toThrow('administrador');
    expect(() =>
      validarCapturaInicial(
        base,
        { ...datos, capturaInicialSupervisada: 'Confirmada por administrador' },
        'ADMINISTRADOR',
      ),
    ).not.toThrow();
    expect(() => validarCapturaInicial(base, datos, 'CAPTURISTA', 'existente')).not.toThrow();
  });
  it('resuelve el operador de la fecha, respeta cambios y no elige entre dos movimientos del mismo día', () => {
    let base = crearDemostracion();
    const primera = {
      maquinariaId: 'maq-1',
      operadorNuevo: 'Uno',
      inicio: '2026-01-01T00:00:00Z',
      motivo: 'Asignación',
      asignacionAnteriorId: null,
    };
    base = {
      ...base,
      asignacionesOperadores: aplicarCambioOperador(
        primera,
        usuarios[0],
        base,
        '2026-01-06T00:00:00Z',
        () => 'asig-1',
      ),
    };
    base.asignacionesOperadores = aplicarCambioOperador(
      {
        ...primera,
        operadorNuevo: 'Dos',
        inicio: '2026-01-03T15:00:00Z',
        asignacionAnteriorId: 'asig-1',
      },
      usuarios[0],
      base,
      '2026-01-06T00:00:00Z',
      () => 'asig-2',
    );
    expect(asignacionParaFecha(base, 'maq-1', '2026-01-02')?.operador).toBe('Uno');
    expect(asignacionParaFecha(base, 'maq-1', fecha)).toBeUndefined();
    expect(asignacionParaFecha(base, 'maq-1', '2026-01-04')?.operador).toBe('Dos');
    expect(base.horometros[0].operador).not.toBe('Dos');
  });
  it('rechaza lecturas exactamente duplicadas y fechas futuras; admite múltiples cargas', () => {
    const base = crearDemostracion();
    expect(() => validarRegistro('horometros', base.horometros[0], undefined, base)).toThrow();
    expect(() =>
      validarRegistro(
        'combustible',
        { ...base.combustible[0], fecha: '2100-01-01' },
        undefined,
        base,
      ),
    ).toThrow('futuro');
    expect(() =>
      validarRegistro('combustible', base.combustible[0], undefined, base),
    ).not.toThrow();
  });
  it('rechaza una nueva captura que no continúa desde la referencia base del horómetro', () => {
    const base = crearDemostracion();
    const maquinaria = base.maquinarias[0];
    maquinaria.horometroBase = 2000;
    const anterior = base.horometros.find((lectura) => lectura.maquinariaId === maquinaria.id)!;
    base.horometros = [
      {
        ...anterior,
        fecha: '2026-11-08',
        fechaAsignacion: '2026-11-08',
        lecturaInicial: 1820,
        lecturaFinal: 1830,
      },
    ];
    expect(() =>
      validarRegistro(
        'horometros',
        {
          ...anterior,
          fecha: '2026-11-09',
          fechaAsignacion: '2026-11-08',
          lecturaInicial: 1830,
          lecturaFinal: 1835,
        },
        undefined,
        base,
      ),
    ).toThrow(/no continúa desde el horómetro anterior/i);
  });
});

it('no conserva una referencia de asignación ajena al cambiar equipo, fecha u operador', async () => {
  const { referenciaAsignacion } = await import('./captura-diaria');
  const base = crearDemostracion();
  const anterior = {
    maquinariaId: 'maq-1',
    fecha: '2020-01-01',
    operador: 'Operador histórico',
    asignacionId: 'asig-anterior',
  };
  expect(referenciaAsignacion(base, anterior, anterior)).toBe('asig-anterior');
  expect(
    referenciaAsignacion(base, { ...anterior, maquinariaId: 'maq-2' }, anterior),
  ).toBeUndefined();
  expect(
    referenciaAsignacion(base, { ...anterior, fecha: '2020-01-02' }, anterior),
  ).toBeUndefined();
  expect(
    referenciaAsignacion(base, { ...anterior, operador: 'Otro operador' }, anterior),
  ).toBeUndefined();
});
