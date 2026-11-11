import { describe, expect, it } from 'vitest';
import { Workbook } from 'exceljs';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { usuarios } from '../../../../pruebas/datos/usuarios';
import { usuarioInvitado } from '../../../modulos/acceso/servicios/permisos';
import { aplicarCargaCatalogos, catalogosIniciales } from './catalogos';
import { leerExcelCatalogos, crearPlantillaCatalogos } from './importar-excel';
import { esquemaBase } from '../../validaciones/base-datos';
const entrada = {
  tipo: 'operadores' as const,
  codigo: 'OP-01',
  nombre: 'Operador de catálogo',
  activo: true,
};
async function archivo(filas: Record<string, string | number>[], hoja = 'Operadores') {
  const libro = new Workbook();
  const pagina = libro.addWorksheet(hoja);
  pagina.columns = Object.keys(filas[0]).map((clave) => ({ header: clave, key: clave }));
  filas.forEach((fila) => pagina.addRow(fila));
  return new Uint8Array(await libro.xlsx.writeBuffer()).buffer;
}
describe('Catálogos y carga inicial', () => {
  it('reutiliza nombres existentes sin replicar registros diarios ni inventar asignaciones', () => {
    const base = crearDemostracion();
    const catalogos = catalogosIniciales(base);
    expect(catalogos.filter((entrada) => entrada.tipo === 'operadores')).toHaveLength(4);
    expect(catalogos[0]).not.toHaveProperty('lecturaInicial');
    expect(catalogos[0].historial).toEqual([]);
    expect(base.asignacionesOperadores).toBeUndefined();
  });
  it('conserva IDs y fuentes, omite existentes por defecto y exige confirmación para actualizarlos', () => {
    const base = crearDemostracion();
    const creada = aplicarCargaCatalogos(
      { entradas: [entrada], maquinarias: [], reemplazar: false },
      base,
      usuarios[0],
    );
    const omitida = aplicarCargaCatalogos(
      { entradas: [{ ...entrada, nombre: 'Cambiado' }], maquinarias: [], reemplazar: false },
      creada,
      usuarios[0],
    );
    expect(omitida.catalogos?.at(-1)?.nombre).toBe(entrada.nombre);
    const editada = aplicarCargaCatalogos(
      { entradas: [{ ...entrada, nombre: 'Cambiado' }], maquinarias: [], reemplazar: true },
      creada,
      usuarios[0],
    );
    expect(editada.catalogos?.at(-1)?.id).toBe(creada.catalogos?.at(-1)?.id);
    expect(editada.catalogos?.at(-1)?.historial).toHaveLength(2);
    expect(editada.horometros).toEqual(base.horometros);
    expect(editada.combustible).toEqual(base.combustible);
    expect(esquemaBase.safeParse(editada).success).toBe(true);
  });
  it('rechaza duplicados del lote y permisos de invitado o capturista', () => {
    const carga = { entradas: [entrada], maquinarias: [], reemplazar: false };
    expect(() =>
      aplicarCargaCatalogos(
        { ...carga, entradas: [entrada, entrada] },
        crearDemostracion(),
        usuarios[0],
      ),
    ).toThrow('duplicado');
    for (const usuario of [usuarioInvitado, usuarios[1]])
      expect(() => aplicarCargaCatalogos(carga, crearDemostracion(), usuario)).toThrow(
        'administrador',
      );
  });
  it('previsualiza Excel sin escribir y detecta duplicados y errores por fila', async () => {
    const base = crearDemostracion();
    const datos = await archivo([
      { codigo: 'op-01', nombre: 'Operador Uno' },
      { codigo: 'OP-01', nombre: 'Operador Dos' },
      { codigo: 'OP-03', nombre: '' },
    ]);
    const vista = await leerExcelCatalogos(datos, 'catalogos.xlsx', base);
    expect(vista.filas).toHaveLength(3);
    expect(vista.filas[1].errores.join()).toContain('duplicado');
    expect(vista.filas[2].errores.join()).toContain('nombre');
    expect(base.catalogos).toBeUndefined();
  });
  it('marca maquinaria existente, conserva ID, lecturas y mantenimiento al actualizar datos generales', async () => {
    const base = crearDemostracion();
    const equipo = base.maquinarias[0];
    const datos = await archivo(
      [
        {
          numeroEconomico: equipo.numeroEconomico,
          placas: equipo.placas,
          tipo: equipo.tipo,
          marca: equipo.marca,
          modelo: 'Nuevo modelo',
        },
      ],
      'Maquinarias',
    );
    const vista = await leerExcelCatalogos(datos, 'maquinas.xlsx', base);
    expect(vista.filas[0].existente).toBe(true);
    const actualizada = aplicarCargaCatalogos(
      { ...vista.carga, reemplazar: true },
      base,
      usuarios[0],
    );
    expect(actualizada.maquinarias[0]).toMatchObject({
      id: equipo.id,
      horometroBase: equipo.horometroBase,
      fechaUltimoMantenimiento: equipo.fechaUltimoMantenimiento,
      modelo: 'Nuevo modelo',
    });
    expect(actualizada.horometros).toEqual(base.horometros);
    expect(() => aplicarCargaCatalogos(vista.carga, actualizada, usuarios[0])).toThrow(
      'ya fue importado',
    );
  });
  it('rechaza archivos vacíos, extensiones incorrectas y encabezados desconocidos', async () => {
    const plantilla = await crearPlantillaCatalogos();
    await expect(
      leerExcelCatalogos(plantilla.buffer as ArrayBuffer, 'plantilla.xlsx', crearDemostracion()),
    ).rejects.toThrow('no contiene');
    await expect(
      leerExcelCatalogos(new ArrayBuffer(0), 'datos.csv', crearDemostracion()),
    ).rejects.toThrow('.xlsx');
    await expect(
      leerExcelCatalogos(
        await archivo([{ desconocido: 'dato' }]),
        'datos.xlsx',
        crearDemostracion(),
      ),
    ).rejects.toThrow('Encabezados');
  });
  it('rechaza fórmulas y muestra errores sin ejecutar su contenido', async () => {
    const libro = new Workbook();
    const hoja = libro.addWorksheet('Operadores');
    hoja.addRow(['codigo', 'nombre']);
    hoja.addRow(['OP-01', { formula: '1+1', result: 2 }]);
    const datos = new Uint8Array(await libro.xlsx.writeBuffer()).buffer;
    const vista = await leerExcelCatalogos(datos, 'formulas.xlsx', crearDemostracion());
    expect(vista.filas[0].errores.join()).toContain('fórmulas');
  });
  it('conserva el día de las celdas Excel de mantenimiento en cualquier zona local', async () => {
    const libro = new Workbook();
    const hoja = libro.addWorksheet('Maquinarias');
    hoja.addRow([
      'numeroEconomico',
      'placas',
      'tipo',
      'marca',
      'modelo',
      'fechaUltimoMantenimiento',
    ]);
    hoja.addRow([
      'EXC-999',
      'ABC-123',
      'Excavadora',
      'Marca',
      'Modelo',
      new Date('2026-10-01T00:00:00Z'),
    ]);
    const datos = new Uint8Array(await libro.xlsx.writeBuffer()).buffer;
    const vista = await leerExcelCatalogos(datos, 'fechas.xlsx', crearDemostracion());
    expect(vista.filas[0].errores).toEqual([]);
    expect(vista.carga.maquinarias[0].fechaUltimoMantenimiento).toBe('2026-10-01');
  });
});

describe('Repositorios de catálogos', () => {
  it('conserva la carga al recargar y rechaza cambios concurrentes', async () => {
    const { RepositorioLocal } = await import('../../servicios/repositorio-local');
    const { vi } = await import('vitest');
    const almacenamiento = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (clave: string) => almacenamiento.get(clave) ?? null,
      setItem: (clave: string, valor: string) => almacenamiento.set(clave, valor),
    });
    try {
      const repositorio = new RepositorioLocal(crearDemostracion);
      const base = await repositorio.cargar();
      const carga = { entradas: [entrada], maquinarias: [], reemplazar: false };
      const siguiente = await repositorio.guardarCatalogos(carga, usuarios[0], base);
      expect((await repositorio.cargar()).catalogos).toEqual(siguiente.catalogos);
      await expect(repositorio.guardarCatalogos(carga, usuarios[0], base)).rejects.toThrow(
        'otra pestaña',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('usa el endpoint REST y revisión sin cambiar las fuentes', async () => {
    const { RepositorioApi } = await import('../../servicios/repositorio-api');
    const { vi } = await import('vitest');
    const base = crearDemostracion();
    const carga = { entradas: [entrada], maquinarias: [], reemplazar: false };
    const siguiente = aplicarCargaCatalogos(carga, base, usuarios[0]);
    const solicitar = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 'v1', datos: base })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 'v2', datos: siguiente })));
    vi.stubGlobal('fetch', solicitar);
    try {
      const repositorio = new RepositorioApi('https://prueba.invalid');
      await repositorio.cargar();
      const resultado = await repositorio.guardarCatalogos(carga, usuarios[0], base);
      expect(resultado.horometros).toEqual(base.horometros);
      expect(solicitar.mock.calls[1][0]).toBe('https://prueba.invalid/catalogos/cargas');
      expect(solicitar.mock.calls[1][1].headers['If-Match']).toBe('v1');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
