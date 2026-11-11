import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearMuestraFicticia } from '../../../../pruebas/datos/operaciones-completas';
import { RepositorioLocal, claveAlmacenamiento } from '../../servicios/repositorio-local';
import { usuarios } from '../../../../pruebas/datos/usuarios';
import { prepararCatalogosFormulario } from './catalogos-formulario';
import { normalizarNombre, aplicarCargaCatalogos } from './catalogos';

const fecha = '2026-11-09';
function almacenamiento() {
  const memoria = new Map<string, string>();
  const escribir = vi.fn((clave: string, valor: string) => memoria.set(clave, valor));
  vi.stubGlobal('localStorage', {
    getItem: (clave: string) => memoria.get(clave) ?? null,
    setItem: escribir,
  });
  return { memoria, escribir };
}
afterEach(() => vi.unstubAllGlobals());
describe('Altas de catálogo desde formularios', () => {
  it('normaliza acentos, espacios y mayúsculas y rechaza duplicados administrativos', () => {
    expect(normalizarNombre('  JOSÉ   Pérez ')).toBe(normalizarNombre('jose perez'));
    const base = crearMuestraFicticia(fecha);
    const actual = base.catalogos!.find((r) => r.tipo === 'residentes')!;
    expect(() =>
      aplicarCargaCatalogos(
        {
          maquinarias: [],
          reemplazar: false,
          entradas: [
            {
              ...actual,
              codigo: 'OTRO',
              nombre: actual.nombre
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''),
            },
          ],
        },
        base,
        usuarios[0],
      ),
    ).toThrow('Ya existe ese nombre');
  });
  it('prepara nombres canónicos e IDs sin persistir ni alterar las capturas anteriores', () => {
    const base = crearMuestraFicticia(fecha);
    const copia = JSON.stringify(base);
    const resultado = prepararCatalogosFormulario(
      'combustible',
      {
        ...base.combustible[2],
        operador: '  JOSE LUIS GARCIA MENDOZA ',
        tipoCombustible: 'Biodiésel B20',
      },
      base,
      usuarios[0],
    );
    expect(resultado.datos.operador).toBe('José Luis García Mendoza');
    expect(resultado.datos.operadorId).toBe('prueba-operadores-01');
    expect(resultado.datos.tipoCombustibleId).toBeTruthy();
    expect(resultado.nuevos.map((r) => r.nombre)).toEqual(['Biodiésel B20']);
    expect(JSON.stringify(base)).toBe(copia);
  });
  it('reutiliza el ID de ubicación conservando el PK escrito en la captura', () => {
    const base = crearMuestraFicticia(fecha);
    const ubicacion = base.catalogos!.find(
      (entrada) => entrada.tipo === 'ubicaciones' && entrada.nombre === '012+350',
    )!;
    const captura = { ...base.combustible[0], pkResidente: 'PK 012 + 350' };
    const preparado = prepararCatalogosFormulario('combustible', captura, base, usuarios[0]);
    expect(preparado.datos).toMatchObject({
      pkResidente: 'PK 012 + 350',
      ubicacionId: ubicacion.id,
    });
    expect(preparado.base.catalogos.filter((entrada) => entrada.tipo === 'ubicaciones')).toEqual(
      base.catalogos!.filter((entrada) => entrada.tipo === 'ubicaciones'),
    );
  });
  it('guarda registro y catálogos en una sola escritura y los reutiliza por ID', async () => {
    const { escribir } = almacenamiento();
    const repositorio = new RepositorioLocal(() => crearMuestraFicticia(fecha));
    const base = await repositorio.cargar();
    escribir.mockClear();
    const datos = {
      ...base.maquinarias[0],
      numeroEconomico: 'PR-999',
      tipo: 'Perforadora',
      marca: 'Marca nueva',
      modelo: 'Modelo nuevo',
    };
    const registro = await repositorio.guardar('maquinarias', datos, undefined, usuarios[0], base, {
      residente: { nombre: 'María Elena Núñez', pk: '099+500' },
    });
    expect(escribir).toHaveBeenCalledTimes(1);
    const siguiente = await repositorio.cargar();
    for (const campo of [
      'tipoId',
      'marcaId',
      'modeloId',
      'residenteId',
      'ubicacionResidenteId',
    ] as const)
      expect(siguiente.catalogos!.some((entrada) => entrada.id === registro[campo])).toBe(true);
    expect(registro.periodosResidentes?.at(-1)).toMatchObject({
      nombre: 'María Elena Núñez',
      pk: '099+500',
      ubicacionId: registro.ubicacionResidenteId,
    });
    expect(siguiente.horometros).toEqual(base.horometros);
    expect(siguiente.combustible).toEqual(base.combustible);
    const duplicado = prepararCatalogosFormulario(
      'maquinarias',
      { ...datos, tipo: ' perforadora ' },
      siguiente,
      usuarios[0],
    );
    expect(duplicado.datos.tipoId).toBe(registro.tipoId);
    expect(duplicado.nuevos).toHaveLength(0);
  });
  it('rechaza nuevas opciones sin privilegios y no escribe si el registro es inválido', async () => {
    const { memoria, escribir } = almacenamiento();
    const repositorio = new RepositorioLocal(() => crearMuestraFicticia(fecha));
    const base = await repositorio.cargar();
    const original = memoria.get(claveAlmacenamiento);
    escribir.mockClear();
    await expect(
      repositorio.guardar(
        'maquinarias',
        { ...base.maquinarias[0], modelo: 'Modelo nuevo' },
        base.maquinarias[0].id,
        usuarios[1],
        base,
        {},
      ),
    ).rejects.toThrow('Solo el administrador');
    await expect(
      repositorio.guardar(
        'maquinarias',
        { ...base.maquinarias[0], tipo: 'Tipo nuevo', numeroEconomico: '' },
        undefined,
        usuarios[0],
        base,
        {},
      ),
    ).rejects.toThrow();
    expect(memoria.get(claveAlmacenamiento)).toBe(original);
    expect(escribir).not.toHaveBeenCalled();
    const conocido = await repositorio.guardar(
      'maquinarias',
      { ...base.maquinarias[0], modelo: 'WA380-8' },
      base.maquinarias[0].id,
      usuarios[1],
      base,
      {},
    );
    expect(conocido.modeloId).toBeTruthy();
  });
  it('crea el operador de una asignación al confirmar y mantiene las fuentes históricas', async () => {
    almacenamiento();
    const repositorio = new RepositorioLocal(() => crearMuestraFicticia(fecha));
    const base = await repositorio.cargar();
    const anterior = base.asignacionesOperadores!.find(
      (r) => r.maquinariaId === 'prueba-maq-01' && !r.fin,
    )!;
    const periodos = await repositorio.cambiarOperador(
      {
        maquinariaId: anterior.maquinariaId,
        operadorNuevo: 'Luis Alberto Gómez',
        inicio: `${fecha}T10:00:00-06:00`,
        motivo: 'Relevo confirmado de prueba',
        asignacionAnteriorId: anterior.id,
      },
      usuarios[0],
      base,
      {},
    );
    const siguiente = await repositorio.cargar();
    expect(siguiente.catalogos!.find((r) => r.id === periodos.at(-1)?.operadorId)?.nombre).toBe(
      'Luis Alberto Gómez',
    );
    expect(siguiente.horometros).toEqual(base.horometros);
    expect(siguiente.combustible).toEqual(base.combustible);
    expect(periodos.find((r) => r.id === anterior.id)?.fin).toBe(`${fecha}T10:00:00-06:00`);
  });
});
