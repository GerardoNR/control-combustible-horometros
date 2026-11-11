import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositorioApi } from './repositorio-api';
import { crearDemostracion } from '../../../pruebas/datos/operaciones-legadas';
import { usuarios } from '../../../pruebas/datos/usuarios';
import { marcarEliminado } from './eliminacion';
afterEach(() => vi.unstubAllGlobals());
describe('Contrato REST consistente', () => {
  it('rechaza IDs ajenos sin avanzar la revisión y permite reintentar con la respuesta correcta', async () => {
    const base = crearDemostracion();
    const equipo = base.maquinarias[0];
    const solicitar = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: '"r1"', datos: base })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ revision: '"r2"', registro: { ...equipo, id: 'ajeno' } })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: '"r2"', registro: equipo })));
    vi.stubGlobal('fetch', solicitar);
    const repositorio = new RepositorioApi('https://api.ejemplo.com');
    const snapshot = await repositorio.cargar();
    await expect(
      repositorio.guardar('maquinarias', equipo, equipo.id, usuarios[0], snapshot),
    ).rejects.toThrow('incompatible');
    await repositorio.guardar('maquinarias', equipo, equipo.id, usuarios[0], snapshot);
    expect(solicitar.mock.calls[2][1].headers['If-Match']).toBe('"r1"');
  });
  it('carga una instantánea y envía su revisión para la eliminación auditada', async () => {
    const base = crearDemostracion();
    const eliminado = marcarEliminado('horometros', base.horometros[0].id, usuarios[0], base);
    const solicitar = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: '"r1"', datos: base })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ revision: '"r2"', registro: eliminado })),
      );
    vi.stubGlobal('fetch', solicitar);
    const repositorio = new RepositorioApi('https://api.ejemplo.com/v1');
    const snapshot = await repositorio.cargar();
    expect(solicitar.mock.calls[0][0]).toBe('https://api.ejemplo.com/v1/operaciones/snapshot');
    expect(
      (await repositorio.eliminar('horometros', eliminado.id, usuarios[0], snapshot)).eliminado,
    ).toBe(true);
    expect(solicitar.mock.calls[1][1].headers['If-Match']).toBe('"r1"');
    expect(solicitar.mock.calls[1][1].method).toBe('DELETE');
  });
  it('no sobrescribe cambios de otra revisión', async () => {
    const base = crearDemostracion();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ revision: '"r1"', datos: base })))
        .mockResolvedValueOnce(new Response('{}', { status: 412 })),
    );
    const repositorio = new RepositorioApi('https://api.ejemplo.com');
    await repositorio.cargar();
    await expect(
      repositorio.guardar(
        'maquinarias',
        base.maquinarias[0],
        base.maquinarias[0].id,
        usuarios[0],
        base,
      ),
    ).rejects.toThrow('cambiaron en el servidor');
  });
});

describe('Control Diario de solo lectura en REST', () => {
  it('no envía escrituras de Control Diario aunque el usuario sea administrador', async () => {
    const solicitar = vi.fn();
    vi.stubGlobal('fetch', solicitar);
    const base = crearDemostracion();
    const repositorio = new RepositorioApi('https://api.ejemplo.com');
    await expect(
      repositorio.guardar(
        'control-diario',
        base['control-diario'][0],
        undefined,
        usuarios[0],
        base,
      ),
    ).rejects.toThrow('solo consulta');
    expect(solicitar).not.toHaveBeenCalled();
  });
});
