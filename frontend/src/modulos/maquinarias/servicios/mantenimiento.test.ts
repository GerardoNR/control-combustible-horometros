import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluarMantenimiento, crearMantenimiento, horometroActual } from './mantenimiento';
import { esquemaMaquinaria } from '../validaciones/maquinaria';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { usuarios } from '../../../../pruebas/datos/usuarios';
import { RepositorioLocal } from '../../../compartido/servicios/repositorio-local';
import { RepositorioApi } from '../../../compartido/servicios/repositorio-api';
import { esquemaBase } from '../../../compartido/validaciones/base-datos';
const datosServicio = (base: ReturnType<typeof crearDemostracion>) => ({
  maquinariaId: base.maquinarias[0].id,
  fecha: base.horometros[0].fecha,
  lecturaHorometro: base.horometros[0].lecturaFinal,
  tipoServicio: 'Cambio de filtros',
});
afterEach(() => vi.unstubAllGlobals());
describe('Mantenimiento por horas', () => {
  it.each([
    [199, 'En rango', 'verde', 1, 51, 0],
    [200, 'Próximo', 'amarillo', 0, 50, 0],
    [250, 'Próximo', 'amarillo', 0, 0, 0],
    [251, 'Vencido', 'rojo', 0, 0, 1],
  ])('evalúa %s horas como %s', (horas, estado, tono, avisoRestante, restantes, excedidas) => {
    const base = crearDemostracion();
    const equipo = base.maquinarias[0];
    const servicio = base.mantenimientos![0];
    servicio.lecturaHorometro = base.horometros[0].lecturaFinal - horas;
    expect(evaluarMantenimiento(equipo, base)).toMatchObject({
      horas,
      estado,
      tono,
      avisoRestante,
      restantes,
      excedidas,
      servicio,
      inicioIntervalo: servicio.lecturaHorometro,
      objetivoAviso: servicio.lecturaHorometro + 200,
      objetivo: servicio.lecturaHorometro + 250,
    });
  });
  it('permite límites por maquinaria y no suma nuevamente las horas diarias', () => {
    const base = crearDemostracion();
    const equipo = base.maquinarias[0];
    equipo.avisoMantenimientoHoras = 100;
    equipo.limiteMantenimientoHoras = 150;
    base.mantenimientos![0].lecturaHorometro = base.horometros[0].lecturaFinal - 120;
    expect(evaluarMantenimiento(equipo, base)).toMatchObject({ horas: 120, estado: 'Próximo' });
    expect(horometroActual(equipo, base)).toBe(base.horometros[0].lecturaFinal);
  });
  it('no deduce una referencia por horas desde fechas antiguas', () => {
    const base = crearDemostracion();
    delete base.mantenimientos;
    expect(evaluarMantenimiento(base.maquinarias[0], base)).toMatchObject({
      estado: 'Sin mantenimiento de referencia',
      horas: null,
    });
    expect(esquemaBase.safeParse(base).success).toBe(true);
  });
  it('conserva los objetivos con servicio válido y sin lecturas activas', () => {
    const base = crearDemostracion();
    const equipo = base.maquinarias[0];
    const inicio = base.mantenimientos![0].lecturaHorometro;
    base.horometros = base.horometros.map((lectura) => ({ ...lectura, eliminado: true }));
    expect(evaluarMantenimiento(equipo, base)).toMatchObject({
      estado: 'Avance pendiente de verificar',
      tono: 'secundario',
      horas: null,
      objetivoAviso: inicio + 200,
      objetivo: inicio + 250,
      avisoRestante: null,
      limiteRestante: null,
      progreso: null,
    });
  });
  it('deja pendiente un reinicio, sustitución, lectura no finita o referencia superior a la actual', () => {
    const base = crearDemostracion();
    const equipo = base.maquinarias[0];
    base.horometros[0].lecturaInicial = 0;
    base.horometros[0].lecturaFinal = 8;
    expect(evaluarMantenimiento(equipo, base)).toMatchObject({
      estado: 'Revisar horómetro',
      tono: 'secundario',
      horas: null,
      avisoRestante: null,
      restantes: null,
      excedidas: null,
    });
    expect(() => crearMantenimiento(datosServicio(base), base, usuarios[0])).toThrow('reinicio');
    base.horometros[0].lecturaFinal = NaN;
    expect(horometroActual(equipo, base)).toBeNull();
    base.horometros = [];
    base.mantenimientos![0].lecturaHorometro = equipo.horometroBase + 1;
    expect(evaluarMantenimiento(equipo, base).horas).toBeNull();
  });
  it('registra un nuevo servicio sin modificar los anteriores ni las fuentes', () => {
    const base = crearDemostracion();
    const antes = structuredClone(base);
    const servicio = crearMantenimiento(datosServicio(base), base, usuarios[0]);
    expect(base).toEqual(antes);
    base.mantenimientos!.push(servicio);
    expect(evaluarMantenimiento(base.maquinarias[0], base).horas).toBe(0);
    expect(base.mantenimientos![0]).toEqual(antes.mantenimientos![0]);
    expect(servicio.historial[0].usuarioId).toBe(usuarios[0].id);
    expect(() => crearMantenimiento(datosServicio(base), base, usuarios[0])).toThrow('ya está');
  });
  it('rechaza falta de permiso, fechas futuras, lecturas futuras y servicios fuera de secuencia', () => {
    const base = crearDemostracion();
    const datos = datosServicio(base);
    expect(() => crearMantenimiento(datos, base, usuarios[2])).toThrow('permiso');
    expect(() => crearMantenimiento({ ...datos, fecha: '2100-01-01' }, base, usuarios[0])).toThrow(
      'futuro',
    );
    expect(() =>
      crearMantenimiento(
        { ...datos, lecturaHorometro: datos.lecturaHorometro + 1 },
        base,
        usuarios[0],
      ),
    ).toThrow('superar');
    expect(() => crearMantenimiento({ ...datos, fecha: '2000-01-01' }, base, usuarios[0])).toThrow(
      'referencia',
    );
  });
  it('persiste el historial y detecta guardados con una base obsoleta', async () => {
    const memoria = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memoria.get(k) ?? null,
      setItem: (k: string, v: string) => memoria.set(k, v),
    });
    const repositorio = new RepositorioLocal(crearDemostracion);
    const base = await repositorio.cargar();
    const servicio = await repositorio.registrarMantenimiento(
      datosServicio(base),
      usuarios[0],
      base,
    );
    const cargada = await repositorio.cargar();
    expect(cargada.mantenimientos).toHaveLength(base.mantenimientos!.length + 1);
    expect(cargada.mantenimientos!.at(-1)).toEqual(servicio);
    expect(cargada.horometros).toEqual(base.horometros);
    await repositorio.guardar(
      'maquinarias',
      { ...cargada.maquinarias[0], modelo: 'Modelo actualizado' },
      cargada.maquinarias[0].id,
      usuarios[0],
      cargada,
    );
    const editada = await repositorio.cargar();
    expect(editada.mantenimientos).toEqual(cargada.mantenimientos);
    expect(editada.maquinarias[0].fechaUltimoMantenimiento).toBe(
      cargada.maquinarias[0].fechaUltimoMantenimiento,
    );
    await expect(
      repositorio.registrarMantenimiento(datosServicio(base), usuarios[0], base),
    ).rejects.toThrow('otra pestaña');
  });
  it('envía servicio y revisión a REST y conserva la colección tras recargar', async () => {
    const base = crearDemostracion();
    const datos = datosServicio(base);
    const registro = crearMantenimiento(datos, base, usuarios[0]);
    const solicitar = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: '"r1"', datos: base })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: '"r2"', registro })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            revision: '"r2"',
            datos: { ...base, mantenimientos: [...base.mantenimientos!, registro] },
          }),
        ),
      );
    vi.stubGlobal('fetch', solicitar);
    const repositorio = new RepositorioApi('https://ejemplo.test');
    const snapshot = await repositorio.cargar();
    expect((await repositorio.registrarMantenimiento(datos, usuarios[0], snapshot)).id).toBe(
      registro.id,
    );
    expect(solicitar.mock.calls[1][0]).toBe('https://ejemplo.test/mantenimientos');
    expect(solicitar.mock.calls[1][1].headers['If-Match']).toBe('"r1"');
    expect((await repositorio.cargar()).mantenimientos!.at(-1)?.id).toBe(registro.id);
  });
});
const equipoAnterior = {
  numeroEconomico: 'EXC-01',
  placas: 'NL-1',
  tipo: 'Excavadora',
  marca: 'CAT',
  modelo: '320',
  estado: 'Operativa',
  horometroBase: 100,
};
describe('Compatibilidad de datos de mantenimiento', () => {
  it('valida límites configurables y rechaza un aviso superior al límite', () => {
    expect(
      esquemaMaquinaria.safeParse({
        ...equipoAnterior,
        avisoMantenimientoHoras: 260,
        limiteMantenimientoHoras: 250,
      }).success,
    ).toBe(false);
    expect(
      esquemaMaquinaria.safeParse({ ...equipoAnterior, avisoMantenimientoHoras: 0 }).success,
    ).toBe(false);
    expect(
      esquemaMaquinaria.safeParse({
        ...equipoAnterior,
        avisoMantenimientoHoras: 150,
        limiteMantenimientoHoras: 200,
      }).success,
    ).toBe(true);
  });
  it('conserva registros anteriores sin agregar fechas', () => {
    const resultado = esquemaMaquinaria.parse(equipoAnterior);
    expect(resultado).not.toHaveProperty('fechaUltimoMantenimiento');
  });
  it('permite campos nuevos vacíos', () => {
    expect(
      esquemaMaquinaria.safeParse({
        ...equipoAnterior,
        fechaUltimoMantenimiento: '',
        fechaProximoMantenimiento: '',
      }).success,
    ).toBe(true);
  });
  it('rechaza fechas futuras para servicios realizados', () => {
    expect(
      esquemaMaquinaria.safeParse({ ...equipoAnterior, fechaUltimoMantenimiento: '2100-12-31' })
        .success,
    ).toBe(false);
  });
  it('rechaza programación anterior o igual al servicio realizado', () => {
    expect(
      esquemaMaquinaria.safeParse({
        ...equipoAnterior,
        fechaUltimoMantenimiento: '2020-01-02',
        fechaProximoMantenimiento: '2020-01-01',
      }).success,
    ).toBe(false);
  });
});
