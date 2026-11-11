import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esquemaSuministro } from '../validaciones/suministro';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import {
  RepositorioLocal,
  claveAlmacenamiento,
} from '../../../compartido/servicios/repositorio-local';
import { usuarios } from '../../../../pruebas/datos/usuarios';
import { consolidarControlDiario } from '../../control-diario/servicios/consolidacion';
const campos = ['nombreResidente', 'pkResidente', 'numeroOrquesta', 'nombreDespachador'] as const;
const detalles = {
  nombreResidente: 'Adriana Prueba',
  pkResidente: '008+045',
  numeroOrquesta: '0007',
  nombreDespachador: 'Luis Prueba',
};
function crearBaseAnterior() {
  const base = crearDemostracion();
  for (const suministro of base.combustible)
    for (const campo of campos) {
      delete suministro[campo];
      for (const cambio of suministro.historial) {
        delete cambio.valores[campo];
        if (cambio.anteriores) delete cambio.anteriores[campo];
      }
    }
  return base;
}
beforeEach(() => {
  const datos = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => datos.set(clave, valor),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('Datos complementarios de combustible', () => {
  it.each([undefined, '', '   '])(
    'migra al residente vacío (%s), conserva datos y persiste al editar',
    async (nombreResidente) => {
      const base = crearDemostracion();
      const registro = {
        ...base.combustible[0],
        nombreResidente,
        ingeniero: 'Responsable anterior',
      };
      localStorage.setItem(
        claveAlmacenamiento,
        JSON.stringify({ ...base, combustible: [registro] }),
      );
      const repositorio = new RepositorioLocal(crearDemostracion);
      const cargada = await repositorio.cargar();
      const suministro = cargada.combustible[0];
      expect(suministro.nombreResidente).toBe('Responsable anterior');
      expect(suministro.responsableLegado).toBe('Responsable anterior');
      expect(suministro).not.toHaveProperty('ingeniero');
      expect(suministro.historial).toEqual(registro.historial);
      expect(suministro.litrosCargados).toBe(registro.litrosCargados);
      await repositorio.guardar(
        'combustible',
        { ...suministro, pkResidente: '010+200' },
        suministro.id,
        usuarios[0],
        cargada,
      );
      const recargada = await repositorio.cargar();
      expect(recargada.combustible[0]).toMatchObject({
        nombreResidente: 'Responsable anterior',
        responsableLegado: 'Responsable anterior',
        pkResidente: '010+200',
      });
    },
  );
  it('no sobrescribe residentes existentes y conserva ambos nombres al migrar', async () => {
    const base = crearDemostracion();
    const registro = {
      ...base.combustible[0],
      nombreResidente: 'Residente actual',
      ingeniero: 'Nombre histórico',
    };
    localStorage.setItem(claveAlmacenamiento, JSON.stringify({ ...base, combustible: [registro] }));
    const cargada = await new RepositorioLocal(crearDemostracion).cargar();
    expect(cargada.combustible[0]).toMatchObject({
      nombreResidente: 'Residente actual',
      responsableLegado: 'Nombre histórico',
    });
    expect(cargada.combustible[0].historial).toEqual(registro.historial);
  });
  it('acepta campos vacíos, conserva ceros de orquesta y normaliza solo espacios externos', () => {
    const base = crearBaseAnterior();
    expect(esquemaSuministro.safeParse(base.combustible[0]).success).toBe(true);
    const validos = esquemaSuministro.parse({
      ...base.combustible[0],
      ...detalles,
      nombreResidente: '  Adriana Prueba  ',
    });
    expect(validos.nombreResidente).toBe('Adriana Prueba');
    expect(validos.numeroOrquesta).toBe('0007');
    expect(validos.pkResidente).toBe('008+045');
    expect(
      esquemaSuministro.safeParse({
        ...base.combustible[0],
        nombreResidente: '',
        pkResidente: '',
        numeroOrquesta: '',
        nombreDespachador: '',
      }).success,
    ).toBe(true);
  });
  it('valida los tipos, longitudes y caracteres del identificador de orquesta', () => {
    const registro = crearDemostracion().combustible[0];
    for (const cambio of [
      { nombreResidente: 'A'.repeat(121) },
      { nombreDespachador: 'A'.repeat(121) },
      { pkResidente: '1'.repeat(61) },
      { numeroOrquesta: '1'.repeat(41) },
      { numeroOrquesta: '<script>' },
      ...campos.map((campo) => ({ [campo]: 123 })),
    ])
      expect(esquemaSuministro.safeParse({ ...registro, ...cambio }).success).toBe(false);
    expect(esquemaSuministro.safeParse({ ...registro, numeroOrquesta: 'ORQ-007/A' }).success).toBe(
      true,
    );
  });
  it('lee los registros anteriores sin inventar detalles ni modificar su almacenamiento', async () => {
    const base = crearBaseAnterior();
    const almacenado = JSON.stringify(base);
    localStorage.setItem(claveAlmacenamiento, almacenado);
    const leida = await new RepositorioLocal(crearDemostracion).cargar();
    for (const campo of campos) expect(leida.combustible[0][campo]).toBeUndefined();
    expect(localStorage.getItem(claveAlmacenamiento)).toBe(almacenado);
  });
  it('registra y edita los detalles con persistencia y auditoría compatibles', async () => {
    const base = crearBaseAnterior();
    localStorage.setItem(claveAlmacenamiento, JSON.stringify(base));
    const repositorio = new RepositorioLocal(crearDemostracion);
    const anterior = base.combustible[0];
    const editado = await repositorio.guardar(
      'combustible',
      { ...anterior, ...detalles },
      anterior.id,
      usuarios[0],
      base,
    );
    const recargada = await repositorio.cargar();
    expect(recargada.combustible[0]).toMatchObject(detalles);
    expect(editado.id).toBe(anterior.id);
    expect(editado.creadoEn).toBe(anterior.creadoEn);
    expect(editado.historial.at(-1)?.anteriores?.nombreResidente).toBe('');
    await repositorio.guardar(
      'combustible',
      { ...editado, pkResidente: '008+120' },
      editado.id,
      usuarios[1],
      recargada,
    );
    const actualizada = await repositorio.cargar();
    expect(actualizada.combustible[0].historial.at(-1)?.anteriores?.pkResidente).toBe('008+045');
    expect(actualizada.combustible[0].pkResidente).toBe('008+120');
    const nuevo = await repositorio.guardar(
      'combustible',
      { ...anterior, ...detalles },
      undefined,
      usuarios[0],
      actualizada,
    );
    expect(
      (await repositorio.cargar()).combustible.find((suministro) => suministro.id === nuevo.id),
    ).toMatchObject(detalles);
  });
  it('usa únicamente litros cargados al consolidar varias cargas, sin duplicarlos por los detalles', () => {
    const base = crearBaseAnterior();
    const antes = consolidarControlDiario(base);
    base.combustible = base.combustible.map((suministro) => ({ ...suministro, ...detalles }));
    expect(
      consolidarControlDiario(base).map((fila) => ({
        id: fila.id,
        horas: fila.horas,
        litros: fila.litros,
        litrosHora: fila.litrosHora,
        horasLitro: fila.horasLitro,
      })),
    ).toEqual(
      antes.map((fila) => ({
        id: fila.id,
        horas: fila.horas,
        litros: fila.litros,
        litrosHora: fila.litrosHora,
        horasLitro: fila.horasLitro,
      })),
    );
    base.combustible.push({
      ...base.combustible[0],
      id: 'otra-carga',
      litrosSolicitados: 100,
      litrosCargados: 40,
    });
    const fila = consolidarControlDiario(base).find((fila) => fila.maquinariaId === 'maq-1')!;
    expect(fila.horas).toBe(8);
    expect(fila.litros).toBe(135);
    expect(fila.litrosHora).toBe(135 / 8);
  });
});
