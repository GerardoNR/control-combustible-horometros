import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositorioApi } from './repositorio-api';
import { crearDemostracion } from '../../../pruebas/datos/operaciones-legadas';
import { usuarios } from '../../../pruebas/datos/usuarios';
import type { BaseDatos } from '../tipos/datos';
import type { EntradaCatalogo } from '../catalogos/tipos/catalogo';
import type { DatosMaquinaria } from '../../modulos/maquinarias/tipos/maquinaria';

afterEach(() => vi.unstubAllGlobals());
describe('Contrato de guardado conjunto de formulario y catálogos', () => {
  it('envía una sola transacción y rechaza respuestas incompletas sin avanzar revisión', async () => {
    const base = crearDemostracion();
    let rechazar = true;
    const solicitar = vi.fn(async (_ruta: string, opciones?: RequestInit) => {
      if (!opciones?.body) return new Response(JSON.stringify({ revision: 'r1', datos: base }));
      const cuerpo = JSON.parse(String(opciones.body)) as {
        datos: DatosMaquinaria;
        id: string;
        entradasNuevas: EntradaCatalogo[];
      };
      const siguiente: BaseDatos = {
        ...base,
        catalogos: cuerpo.entradasNuevas,
        maquinarias: base.maquinarias.map((registro) =>
          registro.id === cuerpo.id ? { ...registro, ...cuerpo.datos } : registro,
        ),
        horometros: rechazar ? [] : base.horometros,
      };
      return new Response(JSON.stringify({ revision: 'r2', datos: siguiente }));
    });
    vi.stubGlobal('fetch', solicitar);
    const repositorio = new RepositorioApi('https://api.ejemplo.com');
    const snapshot = await repositorio.cargar();
    const equipo = snapshot.maquinarias[0];
    await expect(
      repositorio.guardar(
        'maquinarias',
        {
          ...equipo,
          modelo: 'Modelo nuevo',
          consumoMinimoEsperado: 6,
          consumoNormalMaximo: 12,
          consumoAdvertenciaMaximo: 16,
          horasMinimasDiarias: 7,
          referenciaConsumo: 'Criterio autorizado de prueba',
          validadoConsumoPor: 'Supervisión de prueba',
          fechaValidacionConsumo: '2026-11-01',
        },
        equipo.id,
        usuarios[0],
        snapshot,
        {},
      ),
    ).rejects.toThrow('no conserva los registros');
    rechazar = false;
    const guardado = await repositorio.guardar(
      'maquinarias',
      {
        ...equipo,
        modelo: 'Modelo nuevo',
        consumoMinimoEsperado: 6,
        consumoNormalMaximo: 12,
        consumoAdvertenciaMaximo: 16,
        horasMinimasDiarias: 7,
        referenciaConsumo: 'Criterio autorizado de prueba',
        validadoConsumoPor: 'Supervisión de prueba',
        fechaValidacionConsumo: '2026-11-01',
      },
      equipo.id,
      usuarios[0],
      snapshot,
      {},
    );
    expect(guardado.modeloId).toBeTruthy();
    expect(guardado).toMatchObject({
      consumoMinimoEsperado: 6,
      consumoNormalMaximo: 12,
      consumoAdvertenciaMaximo: 16,
      horasMinimasDiarias: 7,
    });
    expect(solicitar).toHaveBeenCalledTimes(3);
    for (const [ruta, opciones] of solicitar.mock.calls.slice(1)) {
      expect(ruta).toBe('https://api.ejemplo.com/operaciones/guardar-con-catalogos');
      expect(opciones?.headers).toMatchObject({ 'If-Match': 'r1' });
      const cuerpo = JSON.parse(String(opciones?.body));
      expect(
        cuerpo.entradasNuevas.some((entrada: EntradaCatalogo) => entrada.nombre === 'Modelo nuevo'),
      ).toBe(true);
      expect(cuerpo).not.toHaveProperty('catalogos');
    }
  });
  it('no intenta escrituras parciales si el servidor aún no implementa la transacción', async () => {
    const base = crearDemostracion();
    const solicitar = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 'r1', datos: base })))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', solicitar);
    const repositorio = new RepositorioApi('https://api.ejemplo.com');
    const snapshot = await repositorio.cargar();
    await expect(
      repositorio.guardar(
        'maquinarias',
        { ...snapshot.maquinarias[0], modelo: 'Modelo nuevo' },
        snapshot.maquinarias[0].id,
        usuarios[0],
        snapshot,
        {},
      ),
    ).rejects.toThrow('404');
    expect(solicitar).toHaveBeenCalledTimes(2);
  });
});
