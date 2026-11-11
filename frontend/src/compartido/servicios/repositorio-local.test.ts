import { crearDemostracion } from '../../../pruebas/datos/operaciones-legadas';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { RepositorioLocal, claveAlmacenamiento } from './repositorio-local';
import { usuarios } from '../../../pruebas/datos/usuarios';
class AlmacenamientoPrueba {
  private datos = new Map<string, string>();
  getItem(clave: string) {
    return this.datos.get(clave) ?? null;
  }
  setItem(clave: string, valor: string) {
    this.datos.set(clave, valor);
  }
}
beforeEach(() => vi.stubGlobal('localStorage', new AlmacenamientoPrueba()));
afterEach(() => vi.unstubAllGlobals());
describe('Persistencia y auditoría locales', () => {
  it('mantiene registros y atribuye la edición al usuario seleccionado', async () => {
    const repositorio = new RepositorioLocal(crearDemostracion);
    const base = await repositorio.cargar();
    const original = base.maquinarias[0];
    const editado = await repositorio.guardar(
      'maquinarias',
      { ...original, modelo: '320 GX' },
      original.id,
      usuarios[1],
      base,
    );
    expect(editado.modificadoPor).toBe(usuarios[1].nombre);
    expect(editado.creadoPor).toBe(original.creadoPor);
    expect(editado.historial.at(-1)?.anteriores?.modelo).toBe('320 GC');
    expect(editado.historial.at(-1)?.valores.modelo).toBe('320 GX');
    expect((await new RepositorioLocal(crearDemostracion).cargar()).maquinarias[0].modelo).toBe('320 GX');
  });
  it('evita sobrescribir cambios de otra pestaña', async () => {
    const repositorio = new RepositorioLocal(crearDemostracion);
    const base = await repositorio.cargar();
    const registro = base.maquinarias[0];
    await repositorio.guardar(
      'maquinarias',
      { ...registro, modelo: 'Otro modelo' },
      registro.id,
      usuarios[0],
      base,
    );
    await expect(
      repositorio.guardar('maquinarias', registro, registro.id, usuarios[1], base),
    ).rejects.toThrow('otra pestaña');
  });
  it('no reemplaza datos locales corruptos por la demostración', async () => {
    localStorage.setItem(claveAlmacenamiento, '{"maquinarias":null}');
    await expect(new RepositorioLocal(crearDemostracion).cargar()).rejects.toThrow('formato inválido');
    expect(localStorage.getItem(claveAlmacenamiento)).toBe('{"maquinarias":null}');
  });
  it('propaga fallos de escritura para evitar confirmar un guardado inexistente', async () => {
    const repositorio = new RepositorioLocal(crearDemostracion);
    const base = await repositorio.cargar();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Almacenamiento lleno');
    });
    await expect(
      repositorio.guardar(
        'maquinarias',
        base.maquinarias[0],
        base.maquinarias[0].id,
        usuarios[0],
        base,
      ),
    ).rejects.toThrow('Almacenamiento lleno');
  });
});

describe('Eliminación con trazabilidad', () => {
  it('recalcula las fuentes al editar/eliminar y conserva la auditoría y los datos históricos', async () => {
    const { consolidarControlDiario } =
      await import('../../modulos/control-diario/servicios/consolidacion');
    const repositorio = new RepositorioLocal(crearDemostracion);
    let base = await repositorio.cargar();
    const original = consolidarControlDiario(base).find(
      (registro) => registro.maquinariaId === 'maq-1',
    )!;
    const editado = await repositorio.guardar(
      'combustible',
      { ...base.combustible[0], litrosCargados: 40 },
      base.combustible[0].id,
      usuarios[0],
      base,
    );
    base = await repositorio.cargar();
    expect(
      consolidarControlDiario(base).find((registro) => registro.id === original.id)?.litros,
    ).toBe(40);
    const eliminado = await repositorio.eliminar('combustible', editado.id, usuarios[1], base);
    expect(eliminado.eliminado).toBe(true);
    expect(eliminado.historial.at(-1)?.accion).toBe('Eliminación');
    expect(eliminado.modificadoPor).toBe(usuarios[1].nombre);
    base = await repositorio.cargar();
    const parcial = consolidarControlDiario(base).find((registro) => registro.id === original.id)!;
    expect(parcial.litros).toBeNull();
    expect(parcial).not.toHaveProperty('actividad');
    expect(parcial.operador).toBe(base.horometros[0].operador);
    expect(parcial.historial.some((cambio) => cambio.accion === 'Eliminación')).toBe(true);
    await repositorio.eliminar('horometros', base.horometros[0].id, usuarios[0], base);
    base = await repositorio.cargar();
    expect(
      consolidarControlDiario(base).find((registro) => registro.id === original.id),
    ).toBeUndefined();
    expect(base['control-diario'].length).toBeGreaterThan(0);
  });
  it('rechaza nuevas capturas y ediciones manuales de Control Diario incluso para administradores', async () => {
    const repositorio = new RepositorioLocal(crearDemostracion);
    const base = await repositorio.cargar();
    const registro = base['control-diario'][0];
    await expect(
      repositorio.guardar('control-diario', registro, undefined, usuarios[0], base),
    ).rejects.toThrow('solo consulta');
    await expect(
      repositorio.guardar('control-diario', registro, registro.id, usuarios[0], base),
    ).rejects.toThrow('solo consulta');
    expect((await repositorio.cargar())['control-diario']).toEqual(base['control-diario']);
  });
  it('impide eliminar fuentes sin permiso', async () => {
    const { usuarioInvitado } = await import('../../modulos/acceso/servicios/permisos');
    const repositorio = new RepositorioLocal(crearDemostracion);
    const base = await repositorio.cargar();
    await expect(
      repositorio.eliminar('horometros', base.horometros[0].id, usuarioInvitado, base),
    ).rejects.toThrow('permiso');
  });
});
