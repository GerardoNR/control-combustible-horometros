import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { catalogosIniciales } from '../../../compartido/catalogos/servicios/catalogos';
import { usuarios } from '../../../../pruebas/datos/usuarios';
import { prepararResidencia } from './periodos-residentes';
import { esquemaMaquinaria } from '../validaciones/maquinaria';
import { RepositorioLocal } from '../../../compartido/servicios/repositorio-local';
import { esquemaBase } from '../../../compartido/validaciones/base-datos';
function preparar() {
  const base = crearDemostracion();
  base.catalogos = catalogosIniciales(base);
  const residentes = base.catalogos.filter((r) => r.tipo === 'residentes');
  return { base, residentes, maquinaria: base.maquinarias[0] };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('Periodos de residentes', () => {
  it('no inventa periodos al leer o editar una maquinaria antigua con residente', () => {
    const { base, residentes, maquinaria } = preparar();
    maquinaria.residenteId = residentes[0].id;
    const editada = prepararResidencia(
      { ...maquinaria, modelo: 'Nuevo' },
      maquinaria,
      base,
      usuarios[0],
      '2026-01-01T10:00:00Z',
    );
    expect(editada.periodosResidentes).toBeUndefined();
    expect(esquemaMaquinaria.parse(editada).residenteId).toBe(residentes[0].id);
  });
  it('abre y cierra periodos conservando nombre, PK y responsables históricos', () => {
    const { base, residentes, maquinaria } = preparar();
    const primera = {
      ...maquinaria,
      ...prepararResidencia(
        {
          ...maquinaria,
          residenteId: residentes[0].id,
          motivoCambioResidente: 'Asignación inicial',
        },
        maquinaria,
        base,
        usuarios[0],
        '2026-01-01T10:00:00Z',
      ),
    };
    const original = structuredClone(primera.periodosResidentes![0]);
    residentes[0].nombre = 'Nombre actualizado';
    residentes[0].pk = '999+000';
    const segunda = prepararResidencia(
      { ...primera, residenteId: residentes[1].id, motivoCambioResidente: 'Cambio de frente' },
      primera,
      base,
      usuarios[1],
      '2026-01-02T10:00:00Z',
      '2026-01-02T10:00:00Z',
    );
    expect(segunda.periodosResidentes).toHaveLength(2);
    expect(segunda.periodosResidentes![0]).toMatchObject({
      nombre: original.nombre,
      pk: original.pk,
      fin: '2026-01-02T10:00:00Z',
      cierre: { motivo: 'Cambio de frente', usuarioId: usuarios[1].id },
    });
    expect(segunda.periodosResidentes![1]).toMatchObject({
      residenteId: residentes[1].id,
      inicio: '2026-01-02T10:00:00Z',
      fin: null,
    });
    expect(primera.periodosResidentes![0]).toEqual(original);
    expect(esquemaMaquinaria.safeParse(segunda).success).toBe(true);
  });
  it('abre un periodo por cambio de PK aunque el motivo y el residente se repitan', () => {
    const { base, residentes, maquinaria } = preparar();
    const anterior = {
      ...maquinaria,
      ...prepararResidencia(
        {
          ...maquinaria,
          residenteId: residentes[0].id,
          ubicacionResidente: 'PK 556+060',
          motivoCambioResidente: 'Cambio de ubicación',
        },
        maquinaria,
        base,
        usuarios[0],
        '2026-01-01T10:00:00Z',
      ),
    };
    const editada = prepararResidencia(
      {
        ...anterior,
        ubicacionResidente: 'PK 120+500',
        motivoCambioResidente: 'Cambio de ubicación confirmado',
      },
      anterior,
      base,
      usuarios[0],
      '2026-01-02T10:00:00Z',
      '2026-01-02T10:00:00Z',
    );
    expect(editada.periodosResidentes?.map(({ pk }) => pk)).toEqual(['PK 556+060', 'PK 120+500']);
    expect(anterior.periodosResidentes?.[0]).toMatchObject({ pk: 'PK 556+060', fin: null });
  });
  it('prioriza la asignación vigente frente a campos heredados desactualizados al editar otros datos', () => {
    const { base, residentes, maquinaria } = preparar();
    const asignada = {
      ...maquinaria,
      ...prepararResidencia(
        {
          ...maquinaria,
          residenteId: residentes[0].id,
          ubicacionResidente: 'PK 450+60',
        },
        maquinaria,
        base,
        usuarios[0],
        '2026-01-01T10:00:00Z',
      ),
    };
    const datosHeredados = {
      ...asignada,
      residenteId: residentes[1].id,
      ubicacionResidente: 'PK 500',
      modelo: 'Modelo actualizado',
    };
    const editada = prepararResidencia(
      datosHeredados,
      asignada,
      base,
      usuarios[0],
      '2026-01-02T10:00:00Z',
    );
    expect(editada.periodosResidentes).toEqual(asignada.periodosResidentes);
    expect(editada).toMatchObject({
      residenteId: residentes[0].id,
      ubicacionResidente: 'PK 450+60',
      modelo: 'Modelo actualizado',
    });
  });
  it('permite confirmar un residente legado sin atribuirle fechas anteriores', () => {
    const { base, residentes, maquinaria } = preparar();
    maquinaria.residenteId = residentes[0].id;
    const confirmada = prepararResidencia(
      { ...maquinaria, motivoCambioResidente: 'Asignación confirmada' },
      maquinaria,
      base,
      usuarios[0],
      '2026-01-05T10:00:00Z',
    );
    expect(confirmada.periodosResidentes).toHaveLength(1);
    expect(confirmada.periodosResidentes![0].inicio).toBe('2026-01-05T10:00:00Z');
  });
  it('usa la fecha visible seleccionada y conserva la hora de auditoría del cambio', () => {
    const { base, residentes, maquinaria } = preparar();
    const fechaActual = '2026-01-08T17:00:00Z';
    const asignada = prepararResidencia(
      { ...maquinaria, residenteId: residentes[0].id },
      maquinaria,
      base,
      usuarios[0],
      fechaActual,
      '2026-01-05T06:00:00.000Z',
    );
    expect(asignada.periodosResidentes?.[0]).toMatchObject({
      inicio: '2026-01-05T06:00:00.000Z',
      registradoEn: fechaActual,
    });
  });
  it('rechaza superposiciones y conserva la baja sin crear un residente ficticio', () => {
    const { base, residentes, maquinaria } = preparar();
    const abierta = {
      ...maquinaria,
      ...prepararResidencia(
        { ...maquinaria, residenteId: residentes[0].id },
        maquinaria,
        base,
        usuarios[0],
        '2026-01-01T10:00:00Z',
      ),
    };
    expect(() =>
      prepararResidencia(
        { ...abierta, residenteId: residentes[1].id },
        abierta,
        base,
        usuarios[0],
        '2025-12-31T10:00:00Z',
        '2025-12-31T10:00:00Z',
      ),
    ).toThrow('posterior');
    const cerrada = prepararResidencia(
      { ...abierta, residenteId: '', motivoCambioResidente: 'Fin de responsabilidad' },
      abierta,
      base,
      usuarios[0],
      '2026-01-02T10:00:00Z',
    );
    expect(cerrada.periodosResidentes).toHaveLength(1);
    expect(cerrada.periodosResidentes![0].fin).toBe('2026-01-02T10:00:00Z');
    const periodo = abierta.periodosResidentes![0];
    expect(
      esquemaMaquinaria.safeParse({
        ...abierta,
        periodosResidentes: [periodo, { ...periodo, id: 'otro' }],
      }).success,
    ).toBe(false);
  });
  it('persiste periodos y auditoría atómicos sin duplicarlos al editar otros campos', async () => {
    const memoria = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memoria.get(k) ?? null,
      setItem: (k: string, v: string) => memoria.set(k, v),
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T15:00:00Z'));
    const repositorio = new RepositorioLocal(crearDemostracion);
    const base = await repositorio.cargar();
    const residentes = base.catalogos!.filter((r) => r.tipo === 'residentes');
    const registro = await repositorio.guardar(
      'maquinarias',
      { ...base.maquinarias[0], residenteId: residentes[0].id },
      base.maquinarias[0].id,
      usuarios[0],
      base,
      {
        fechaInicioResidente: '2026-11-05',
        residente: { nombre: residentes[0].nombre, pk: residentes[0].pk ?? '012+000' },
      },
    );
    expect(registro.periodosResidentes).toHaveLength(1);
    const guardada = await repositorio.cargar();
    vi.setSystemTime(new Date('2026-11-08T15:00:00Z'));
    const nueva = await repositorio.guardar(
      'maquinarias',
      { ...registro, residenteId: residentes[1].id, motivoCambioResidente: 'Relevo' },
      registro.id,
      usuarios[0],
      guardada,
    );
    const recargada = await repositorio.cargar();
    expect(nueva.periodosResidentes).toHaveLength(2);
    expect(recargada.maquinarias[0].periodosResidentes).toEqual(nueva.periodosResidentes);
    expect(recargada.maquinarias[0].historial.at(-1)?.valores.residenteId).toBe(residentes[1].id);
    expect(recargada.maquinarias[0].historial.at(-1)?.valores).not.toHaveProperty(
      'periodosResidentes',
    );
    vi.setSystemTime(new Date('2026-11-09T15:00:00Z'));
    const editada = await repositorio.guardar(
      'maquinarias',
      { ...nueva, modelo: 'Edición general' },
      nueva.id,
      usuarios[0],
      recargada,
    );
    expect(editada.periodosResidentes).toEqual(nueva.periodosResidentes);
    expect(esquemaBase.safeParse(await repositorio.cargar()).success).toBe(true);
    await expect(
      repositorio.guardar(
        'maquinarias',
        { ...nueva, residenteId: '' },
        nueva.id,
        usuarios[0],
        recargada,
      ),
    ).rejects.toThrow('otra pestaña');
  });
});
