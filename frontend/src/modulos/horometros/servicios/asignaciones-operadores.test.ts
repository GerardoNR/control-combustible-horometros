import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aplicarCambioOperador, validarCambioOperador } from './asignaciones-operadores';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { usuarios } from '../../../../pruebas/datos/usuarios';
import { usuarioInvitado } from '../../acceso/servicios/permisos';
import {
  RepositorioLocal,
  claveAlmacenamiento,
} from '../../../compartido/servicios/repositorio-local';
import { RepositorioApi } from '../../../compartido/servicios/repositorio-api';
import { esquemaHorometro } from '../validaciones/horometro';
import { esquemaAsignacionOperador } from '../validaciones/asignacion-operador';
import { consolidarControlDiario } from '../../control-diario/servicios/consolidacion';
import type { DatosCambioOperador } from '../tipos/asignacion-operador';
const ahora = '2026-11-06T18:30:00Z';
const inicial: DatosCambioOperador = {
  maquinariaId: 'maq-1',
  operadorNuevo: 'Operador Uno',
  inicio: '2026-11-01T08:00:00-06:00',
  motivo: 'Inicio de asignación confirmado',
  asignacionAnteriorId: null,
};
const cambio: DatosCambioOperador = {
  ...inicial,
  operadorNuevo: 'Operador Dos',
  inicio: '2026-11-02T08:00:00-06:00',
  motivo: 'Cambio de turno',
  asignacionAnteriorId: 'asig-1',
};
function baseAsignada() {
  const base = crearDemostracion();
  base.asignacionesOperadores = aplicarCambioOperador(
    inicial,
    usuarios[0],
    base,
    ahora,
    () => 'asig-1',
  );
  return base;
}
beforeEach(() => {
  const datos = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => datos.set(clave, valor),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('Asignaciones independientes de operadores', () => {
  it('no reconstruye movimientos de las lecturas existentes y acepta registros sin hora', async () => {
    const repositorio = new RepositorioLocal(crearDemostracion);
    const base = await repositorio.cargar();
    expect(base.asignacionesOperadores).toBeUndefined();
    expect(base.horometros[0].operador).toBeTruthy();
    expect(esquemaHorometro.safeParse(base.horometros[0]).success).toBe(true);
    expect(
      esquemaHorometro.safeParse({ ...base.horometros[0], horaAsignacion: '07:35' }).success,
    ).toBe(true);
    const datos = esquemaHorometro.parse({
      ...base.horometros[0],
      horaAsignacion: '07:35',
      actividad: 'Dato anterior',
      frenteId: 'frente-anterior',
    });
    expect(datos).not.toHaveProperty('horaAsignacion');
    expect(datos).not.toHaveProperty('actividad');
    expect(datos).not.toHaveProperty('frenteId');
  });
  it('conserva campos anteriores al cargar y editar, sin reescribir fechas, operadores ni movimientos', async () => {
    const base = crearDemostracion();
    const anterior = base.horometros[0];
    Object.assign(anterior, {
      actividad: 'Frente histórico',
      frenteId: 'frente-anterior',
      horaAsignacion: '07:35',
    });
    localStorage.setItem(claveAlmacenamiento, JSON.stringify(base));
    const repositorio = new RepositorioLocal();
    const cargada = await repositorio.cargar();
    const guardado = await repositorio.guardar(
      'horometros',
      esquemaHorometro.parse(anterior),
      anterior.id,
      usuarios[0],
      cargada,
    );
    expect(guardado).toMatchObject({
      actividad: 'Frente histórico',
      frenteId: 'frente-anterior',
      horaAsignacion: '07:35',
      fechaAsignacion: anterior.fechaAsignacion,
      operador: anterior.operador,
    });
    expect(guardado.historial.slice(0, anterior.historial.length)).toEqual(anterior.historial);
    const recargada = await repositorio.cargar();
    expect(recargada.asignacionesOperadores).toEqual(cargada.asignacionesOperadores);
    expect(recargada.horometros[0]).toEqual(guardado);
    const datosOperativos = (datos: typeof base) =>
      consolidarControlDiario(datos).map(
        ({ id, fecha, operador, horas, litros, litrosHora, lecturasHorometro }) => ({
          id,
          fecha,
          operador,
          horas,
          litros,
          litrosHora,
          lecturasHorometro,
        }),
      );
    expect(datosOperativos(recargada)).toEqual(datosOperativos(cargada));
  });
  it('registra una asignación explícita con el operador y la cuenta responsable separados', () => {
    const base = crearDemostracion();
    const asignaciones = aplicarCambioOperador(inicial, usuarios[0], base, ahora, () => 'asig-1');
    expect(asignaciones).toHaveLength(1);
    expect(asignaciones[0]).toMatchObject({
      id: 'asig-1',
      operador: 'Operador Uno',
      fin: null,
      asignacionAnteriorId: null,
      usuarioResponsableId: usuarios[0].id,
      usuarioResponsableNombre: usuarios[0].nombre,
      registradoEn: ahora,
    });
    expect(base.asignacionesOperadores).toBeUndefined();
  });
  it('cierra la anterior al iniciar la nueva y conserva ambos periodos e identidades', () => {
    const base = baseAsignada();
    const antes = structuredClone(base.asignacionesOperadores);
    const asignaciones = aplicarCambioOperador(cambio, usuarios[1], base, ahora, () => 'asig-2');
    expect(asignaciones).toHaveLength(2);
    expect(asignaciones[0].inicio).toBe(inicial.inicio);
    expect(asignaciones[0].fin).toBe(cambio.inicio);
    expect(asignaciones[0].usuarioResponsableId).toBe(usuarios[0].id);
    expect(asignaciones[0].cierre).toMatchObject({
      motivo: 'Cambio de turno',
      usuarioResponsableId: usuarios[1].id,
    });
    expect(asignaciones[1]).toMatchObject({
      id: 'asig-2',
      asignacionAnteriorId: 'asig-1',
      fin: null,
      usuarioResponsableId: usuarios[1].id,
    });
    expect(base.asignacionesOperadores).toEqual(antes);
  });
  it('no altera operadores, lecturas, suministros, auditoría ni consolidación históricos', () => {
    const base = baseAsignada();
    const anterior = structuredClone(base);
    const consolidado = consolidarControlDiario(base);
    base.asignacionesOperadores = aplicarCambioOperador(
      cambio,
      usuarios[1],
      base,
      ahora,
      () => 'asig-2',
    );
    expect(base.horometros).toEqual(anterior.horometros);
    expect(base.combustible).toEqual(anterior.combustible);
    expect(base['control-diario']).toEqual(anterior['control-diario']);
    expect(consolidarControlDiario(base)).toEqual(consolidado);
  });
  it('valida fechas, motivos, maquinaria y cambios de operador reales', () => {
    const base = baseAsignada();
    for (const datos of [
      { ...cambio, inicio: '2026-13-30T00:00:00Z' },
      { ...cambio, inicio: '2100-01-01T00:00:00Z' },
      { ...cambio, inicio: inicial.inicio },
      { ...cambio, inicio: '2026-10-31T00:00:00Z' },
      { ...cambio, motivo: ' ' },
      { ...cambio, maquinariaId: 'no-existe' },
      { ...cambio, operadorNuevo: ' OPERADOR   UNO ' },
    ])
      expect(() => validarCambioOperador(datos, base, ahora)).toThrow();
  });
  it('rechaza formularios obsoletos y dos asignaciones vigentes en un equipo', () => {
    const base = baseAsignada();
    expect(() =>
      validarCambioOperador({ ...cambio, asignacionAnteriorId: null }, base, ahora),
    ).toThrow('cambió');
    base.asignacionesOperadores!.push({ ...base.asignacionesOperadores![0], id: 'incompatible' });
    expect(() => validarCambioOperador(cambio, base, ahora)).toThrow('incompatibles');
  });
  it('evita un operador simultáneo en otra maquinaria y permite límites de intervalos contiguos', () => {
    const base = baseAsignada();
    expect(() =>
      validarCambioOperador(
        {
          ...inicial,
          maquinariaId: 'maq-2',
          operadorNuevo: ' operadór  uno ',
          inicio: cambio.inicio,
        },
        base,
        ahora,
      ),
    ).toThrow('otra maquinaria');
    base.asignacionesOperadores = aplicarCambioOperador(
      cambio,
      usuarios[1],
      base,
      ahora,
      () => 'asig-2',
    );
    expect(() =>
      validarCambioOperador(
        { ...inicial, maquinariaId: 'maq-2', inicio: cambio.inicio },
        base,
        ahora,
      ),
    ).not.toThrow();
    expect(() =>
      validarCambioOperador(
        { ...inicial, maquinariaId: 'maq-2', inicio: inicial.inicio },
        base,
        ahora,
      ),
    ).toThrow('otra maquinaria');
  });
  it('respeta permisos del módulo Maquinarias para cambiar operadores vigentes', () => {
    const base = crearDemostracion();
    expect(() => aplicarCambioOperador(inicial, usuarioInvitado, base, ahora)).toThrow('permiso');
    expect(() =>
      aplicarCambioOperador(inicial, { ...usuarios[1], permisos: ['combustible'] }, base, ahora),
    ).toThrow('permiso');
    expect(() =>
      aplicarCambioOperador(inicial, { ...usuarios[0], activo: false }, base, ahora),
    ).toThrow('permiso');
    expect(() => aplicarCambioOperador(inicial, usuarios[1], base, ahora)).not.toThrow();
    expect(() => aplicarCambioOperador(inicial, usuarios[2], base, ahora)).toThrow('permiso');
  });
  it('persiste apertura y cierre con un único guardado sin perder las colecciones anteriores', async () => {
    const repositorio = new RepositorioLocal(crearDemostracion);
    let base = await repositorio.cargar();
    const fuentes = structuredClone(base);
    await repositorio.cambiarOperador(
      { ...inicial, inicio: '2020-01-01T12:00:00Z' },
      usuarios[0],
      base,
    );
    base = await repositorio.cargar();
    const id = base.asignacionesOperadores![0].id;
    await repositorio.cambiarOperador(
      { ...cambio, inicio: '2020-01-02T12:00:00Z', asignacionAnteriorId: id },
      usuarios[1],
      base,
    );
    const actual = await repositorio.cargar();
    expect(actual.asignacionesOperadores).toHaveLength(2);
    expect(actual.asignacionesOperadores![0].fin).toBe('2020-01-02T12:00:00Z');
    expect(actual.horometros).toEqual(fuentes.horometros);
    expect(actual.combustible).toEqual(fuentes.combustible);
    expect(actual['control-diario']).toEqual(fuentes['control-diario']);
  });
  it('rechaza estados obsoletos y no confirma escrituras fallidas', async () => {
    const repositorio = new RepositorioLocal(crearDemostracion);
    const base = await repositorio.cargar();
    await repositorio.cambiarOperador(
      { ...inicial, inicio: '2020-01-01T12:00:00Z' },
      usuarios[0],
      base,
    );
    await expect(
      repositorio.cambiarOperador(
        { ...inicial, maquinariaId: 'maq-2', inicio: '2020-01-01T12:00:00Z' },
        usuarios[0],
        base,
      ),
    ).rejects.toThrow('otra pestaña');
    const actual = await repositorio.cargar();
    const almacenado = localStorage.getItem(claveAlmacenamiento);
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Almacenamiento lleno');
    });
    await expect(
      repositorio.cambiarOperador(
        {
          ...cambio,
          inicio: '2020-01-02T12:00:00Z',
          asignacionAnteriorId: actual.asignacionesOperadores![0].id,
        },
        usuarios[1],
        actual,
      ),
    ).rejects.toThrow('Almacenamiento lleno');
    expect(localStorage.getItem(claveAlmacenamiento)).toBe(almacenado);
  });
  it('valida el cierre y conserva asignaciones al consumir el contrato REST con revisión', async () => {
    const base = baseAsignada();
    const siguiente = aplicarCambioOperador(cambio, usuarios[1], base, ahora, () => 'asig-2');
    expect(
      esquemaAsignacionOperador.safeParse({ ...siguiente[0], fin: siguiente[0].inicio }).success,
    ).toBe(false);
    const solicitar = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: '"r1"', datos: base })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ revision: '"r2"', asignacionesOperadores: siguiente })),
      );
    vi.stubGlobal('fetch', solicitar);
    const repositorio = new RepositorioApi('https://api.ejemplo.com/v1');
    const snapshot = await repositorio.cargar();
    expect(await repositorio.cambiarOperador(cambio, usuarios[1], snapshot)).toEqual(siguiente);
    expect(solicitar.mock.calls[1][0]).toBe(
      'https://api.ejemplo.com/v1/asignaciones-operadores/cambios',
    );
    expect(solicitar.mock.calls[1][1].headers['If-Match']).toBe('"r1"');
    expect(JSON.parse(solicitar.mock.calls[1][1].body)).toEqual(cambio);
  });
});
