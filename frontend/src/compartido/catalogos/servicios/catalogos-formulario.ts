import { referenciaAsignacion } from '../../servicios/captura-diaria';
import type { BaseDatos, Modulo, MapaDatos, Usuario } from '../../tipos/datos';
import type { TipoCatalogo, EntradaCatalogo, ReferenciasFormulario } from '../tipos/catalogo';
import { catalogosIniciales, claveNombreCatalogo, normalizarNombre } from './catalogos';
import { esquemaEntradaCatalogo } from '../validaciones/catalogo';
import { puedeAdministrar } from '../../../modulos/acceso/servicios/permisos';
import { valoresAuditables } from '../../utilidades/auditoria';

export function catalogosFormulario(base: BaseDatos): EntradaCatalogo[] {
  const entradas = [...(base.catalogos ?? [])];
  for (const legado of catalogosIniciales(base)) {
    if (
      !entradas.some(
        (entrada) =>
          entrada.tipo === legado.tipo &&
          claveNombreCatalogo(legado.tipo, entrada.nombre) ===
            claveNombreCatalogo(legado.tipo, legado.nombre),
      )
    ) {
      entradas.push({ ...legado, id: `derivado-${legado.id}`, codigo: `DER-${legado.codigo}` });
    }
  }
  for (const nombre of ['Diésel', 'Gasolina']) {
    if (
      !entradas.some(
        (entrada) =>
          entrada.tipo === 'combustibles' &&
          normalizarNombre(entrada.nombre) === normalizarNombre(nombre),
      )
    ) {
      entradas.push({
        tipo: 'combustibles',
        nombre,
        codigo: `BASE-${normalizarNombre(nombre).toLocaleUpperCase('es')}`,
        id: `base-combustible-${normalizarNombre(nombre)}`,
        activo: true,
        creadoEn: '2000-01-01T00:00:00Z',
        modificadoEn: '2000-01-01T00:00:00Z',
        creadoPor: 'Catálogo inicial del sistema',
        modificadoPor: 'Catálogo inicial del sistema',
        historial: [],
      });
    }
  }
  return entradas;
}

// Prepara altas y referencias en memoria; el repositorio confirma una sola escritura.
export function prepararCatalogosFormulario<Clave extends Modulo>(
  modulo: Clave,
  datos: MapaDatos[Clave],
  base: BaseDatos,
  usuario: Usuario,
  id?: string,
  referencias: ReferenciasFormulario = {},
) {
  const catalogos = catalogosFormulario(base);
  const nuevos: EntradaCatalogo[] = [];
  const valores = { ...datos } as Record<string, unknown>;
  const anterior = base[modulo].find((registro) => registro.id === id);
  function resolver(tipo: TipoCatalogo, nombre: string, historico = false, pk = '') {
    if (!nombre.trim()) return undefined;
    let entrada = catalogos.find(
      (actual) =>
        actual.tipo === tipo &&
        claveNombreCatalogo(tipo, actual.nombre) === claveNombreCatalogo(tipo, nombre),
    );
    if (entrada && !entrada.activo && !historico)
      throw new Error('El dato está inactivo. Selecciona una opción vigente.');
    if (!entrada) {
      if (!puedeAdministrar(usuario))
        throw new Error(
          'Solo el administrador puede agregar valores nuevos a los catálogos. Selecciona una opción existente.',
        );
      const identificador = crypto.randomUUID();
      const datosEntrada = esquemaEntradaCatalogo.parse({
        tipo,
        nombre: tipo === 'ubicaciones' ? nombre : nombre.trim().replace(/\s+/g, ' '),
        codigo: `ALT-${identificador}`,
        pk,
        activo: true,
      });
      const fecha = new Date().toISOString();
      entrada = {
        ...datosEntrada,
        id: identificador,
        creadoEn: fecha,
        creadoPor: usuario.nombre,
        modificadoEn: fecha,
        modificadoPor: usuario.nombre,
        historial: [
          {
            fecha,
            usuarioId: usuario.id,
            usuarioNombre: usuario.nombre,
            accion: 'Creación',
            valores: valoresAuditables(datosEntrada),
          },
        ],
      };
      catalogos.push(entrada);
      nuevos.push(entrada);
    }
    return entrada;
  }
  function vincular(tipo: TipoCatalogo, campo: string, campoId: string) {
    const nombre = valores[campo];
    if (typeof nombre !== 'string' || !nombre.trim()) {
      valores[campoId] = undefined;
      return;
    }
    const historico = !!anterior && Reflect.get(anterior, campo) === nombre;
    const entrada = resolver(
      tipo,
      nombre,
      historico,
      campo === 'nombreResidente' ? String(valores.pkResidente ?? '') : '',
    );
    if (entrada) {
      valores[campo] = historico || tipo === 'ubicaciones' ? nombre : entrada.nombre;
      valores[campoId] =
        historico && Reflect.get(anterior!, campoId) ? Reflect.get(anterior!, campoId) : entrada.id;
    }
  }
  if (modulo === 'maquinarias') {
    vincular('tiposMaquinaria', 'tipo', 'tipoId');
    vincular('marcas', 'marca', 'marcaId');
    vincular('modelos', 'modelo', 'modeloId');
    if (referencias.residente) {
      const { nombre, pk } = referencias.residente;
      if (!nombre.trim() && pk.trim())
        throw new Error('Selecciona o escribe el residente para guardar su ubicación.');
      const entrada = resolver('residentes', nombre, false, pk);
      valores.residenteId = entrada?.id ?? '';
      // La ubicación pertenece al periodo; no se sobrescribe el catálogo del residente.
      valores.ubicacionResidente = pk;
      vincular('ubicaciones', 'ubicacionResidente', 'ubicacionResidenteId');
    }
  } else if (modulo === 'horometros' || modulo === 'combustible') {
    vincular('operadores', 'operador', 'operadorId');
    if (modulo === 'combustible') {
      vincular('residentes', 'nombreResidente', 'residenteId');
      vincular('ubicaciones', 'pkResidente', 'ubicacionId');
      vincular('despachadores', 'nombreDespachador', 'despachadorId');
      vincular('combustibles', 'tipoCombustible', 'tipoCombustibleId');
    }
  }
  if (modulo === 'horometros' || modulo === 'combustible') {
    const captura = valores as MapaDatos['horometros'] | MapaDatos['combustible'];
    valores.asignacionId = referenciaAsignacion(
      base,
      captura,
      anterior && 'operador' in anterior ? anterior : undefined,
    );
  }
  return { base: { ...base, catalogos }, datos: valores as MapaDatos[Clave], nuevos };
}
