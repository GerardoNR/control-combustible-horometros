import { clavePk } from '../../utilidades/pk';
import { valoresAuditables } from '../../utilidades/auditoria';
import { prepararResidencia } from '../../../modulos/maquinarias/servicios/periodos-residentes';
import type { BaseDatos, Auditoria, Usuario } from '../../tipos/datos';
import type {
  DatosEntradaCatalogo,
  EntradaCatalogo,
  CargaCatalogos,
  TipoCatalogo,
} from '../tipos/catalogo';
import { esquemaCargaCatalogos } from '../validaciones/catalogo';
import { puedeAdministrar } from '../../../modulos/acceso/servicios/permisos';
export const claveCatalogo = (tipo: string, codigo: string) =>
  `${tipo}:${codigo.trim().toLocaleUpperCase('es')}`;
export const normalizarNombre = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
export const claveNombreCatalogo = (tipo: TipoCatalogo, valor: string) =>
  (tipo === 'ubicaciones' ? clavePk(valor) : undefined) ?? normalizarNombre(valor);

export function buscarCatalogo(base: BaseDatos, tipo: TipoCatalogo, nombre: string) {
  const coincidencias = (base.catalogos ?? []).filter(
    (entrada) =>
      entrada.activo &&
      entrada.tipo === tipo &&
      claveNombreCatalogo(tipo, entrada.nombre) === claveNombreCatalogo(tipo, nombre),
  );
  return coincidencias.length === 1 ? coincidencias[0] : undefined;
}
export function catalogosIniciales(base: BaseDatos): EntradaCatalogo[] {
  const entradas = new Map<string, EntradaCatalogo>();
  function agregar(tipo: TipoCatalogo, nombre: string | undefined, auditoria: Auditoria, pk = '') {
    if (!nombre?.trim()) return;
    const clave = `${tipo}:${claveNombreCatalogo(tipo, nombre)}`;
    if (entradas.has(clave)) return;
    const codigo = `LEG-${tipo.slice(0, 3).toUpperCase()}-${[...entradas.values()].filter((entrada) => entrada.tipo === tipo).length + 1}`;
    entradas.set(clave, {
      creadoEn: auditoria.creadoEn,
      creadoPor: auditoria.creadoPor,
      modificadoEn: auditoria.modificadoEn,
      modificadoPor: auditoria.modificadoPor,
      id: `cat-${codigo}`,
      tipo,
      codigo,
      nombre: nombre.trim(),
      pk,
      activo: true,
      historial: [],
    });
  }
  base.maquinarias.forEach((registro) => {
    agregar('tiposMaquinaria', registro.tipo, registro);
    agregar('marcas', registro.marca, registro);
    agregar('modelos', registro.modelo, registro);
    agregar('ubicaciones', registro.ubicacionResidente, registro);
    registro.periodosResidentes?.forEach((periodo) => {
      agregar('ubicaciones', periodo.pk, registro);
      agregar('residentes', periodo.nombre, registro, periodo.pk);
    });
  });
  base.horometros.forEach((registro) => {
    agregar('operadores', registro.operador, registro);
    agregar('frentes', registro.actividad, registro);
  });
  base.combustible.forEach((registro) => {
    agregar('combustibles', registro.tipoCombustible, registro);
    agregar('ubicaciones', registro.pkResidente, registro);
    agregar('operadores', registro.operador, registro);
    agregar('residentes', registro.nombreResidente, registro, registro.pkResidente);
    agregar('despachadores', registro.nombreDespachador, registro);
    agregar('frentes', registro.actividad, registro);
  });
  (base.asignacionesOperadores ?? []).forEach((asignacion) =>
    agregar('operadores', asignacion.operador, {
      id: asignacion.id,
      creadoEn: asignacion.registradoEn,
      modificadoEn: asignacion.registradoEn,
      creadoPor: asignacion.usuarioResponsableNombre,
      modificadoPor: asignacion.usuarioResponsableNombre,
      historial: [],
    }),
  );
  return [...entradas.values()];
}
function auditar(datos: object, anterior: Auditoria | undefined, usuario: Usuario): Auditoria {
  const fecha = new Date().toISOString();
  const valores = valoresAuditables(datos);
  const anteriores = anterior
    ? Object.fromEntries(
        Object.keys(valores).map((clave) => [clave, String(Reflect.get(anterior, clave) ?? '')]),
      )
    : undefined;
  return {
    id: anterior?.id ?? crypto.randomUUID(),
    creadoEn: anterior?.creadoEn ?? fecha,
    creadoPor: anterior?.creadoPor ?? usuario.nombre,
    modificadoEn: fecha,
    modificadoPor: usuario.nombre,
    historial: [
      ...(anterior?.historial ?? []),
      {
        fecha,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: anterior ? 'Edición' : 'Creación',
        valores,
        anteriores,
      },
    ],
  };
}
export function aplicarCargaCatalogos(
  solicitud: CargaCatalogos,
  base: BaseDatos,
  usuario: Usuario,
): BaseDatos {
  if (!puedeAdministrar(usuario))
    throw new Error('Solo el administrador puede gestionar catálogos.');
  const carga = esquemaCargaCatalogos.parse(solicitud);
  if (
    carga.importacion &&
    base.importacionesCatalogos?.some((registro) => registro.huella === carga.importacion?.huella)
  )
    throw new Error('Este archivo ya fue importado. No se volverá a cargar.');
  const vistos = new Set<string>();
  const maquinarias = [...base.maquinarias];
  const catalogos = [...(base.catalogos ?? catalogosIniciales(base))];
  for (const datos of carga.maquinarias) {
    const clave = claveCatalogo('maquinarias', datos.numeroEconomico);
    if (vistos.has(clave))
      throw new Error(`Identificador duplicado en la carga: ${datos.numeroEconomico}.`);
    vistos.add(clave);
    const indice = maquinarias.findIndex(
      (equipo) => claveCatalogo('maquinarias', equipo.numeroEconomico) === clave,
    );
    if (indice >= 0 && !carga.reemplazar) continue;
    const anterior = maquinarias[indice];
    // Los campos opcionales ausentes en Excel conservan el dato existente.
    const combinados = prepararResidencia(
      { ...anterior, ...datos },
      anterior,
      base,
      usuario,
      new Date().toISOString(),
    );
    const registro = {
      ...combinados,
      ...auditar(datos, anterior, usuario),
    };
    if (indice >= 0) maquinarias[indice] = registro;
    else maquinarias.push(registro);
  }
  for (const datos of carga.entradas) {
    const clave = claveCatalogo(datos.tipo, datos.codigo);
    if (vistos.has(clave)) throw new Error(`Identificador duplicado en la carga: ${datos.codigo}.`);
    vistos.add(clave);
    const indice = catalogos.findIndex(
      (entrada) => claveCatalogo(entrada.tipo, entrada.codigo) === clave,
    );
    if (indice >= 0 && !carga.reemplazar) continue;
    if (
      catalogos.some(
        (entrada, posicion) =>
          posicion !== indice &&
          entrada.tipo === datos.tipo &&
          claveNombreCatalogo(datos.tipo, entrada.nombre) ===
            claveNombreCatalogo(datos.tipo, datos.nombre),
      )
    )
      throw new Error('Ya existe ese nombre en el catálogo. Selecciona el dato registrado.');
    const anterior = catalogos[indice];
    const registro = {
      ...anterior,
      ...datos,
      ...auditar(datos, anterior, usuario),
    };
    if (indice >= 0) catalogos[indice] = registro;
    else catalogos.push(registro);
  }
  return {
    ...base,
    maquinarias,
    catalogos,
    importacionesCatalogos: carga.importacion
      ? [
          ...(base.importacionesCatalogos ?? []),
          { ...carga.importacion, fecha: new Date().toISOString(), usuarioId: usuario.id },
        ]
      : base.importacionesCatalogos,
  };
}
export function entradasTipo(base: BaseDatos, tipo: TipoCatalogo): DatosEntradaCatalogo[] {
  return (base.catalogos ?? []).filter((entrada) => entrada.tipo === tipo && entrada.activo);
}
