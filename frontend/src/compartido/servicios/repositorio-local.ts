import { exigirPermisoConsumo } from '../../modulos/control-diario/servicios/evaluacion-consumo';
import { prepararCatalogosFormulario } from '../catalogos/servicios/catalogos-formulario';
import type { ReferenciasFormulario } from '../catalogos/tipos/catalogo';
import { valoresAuditables } from '../utilidades/auditoria';
import {
  prepararResidencia,
  instanteFechaResidente,
} from '../../modulos/maquinarias/servicios/periodos-residentes';
import { crearMantenimiento } from '../../modulos/maquinarias/servicios/mantenimiento';
import type { DatosMantenimiento } from '../../modulos/maquinarias/tipos/mantenimiento';
import { validarCapturaInicial } from './captura-diaria';
import type { CargaCatalogos } from '../catalogos/tipos/catalogo';
import { aplicarCargaCatalogos, catalogosIniciales } from '../catalogos/servicios/catalogos';
import { aplicarCambioOperador } from '../../modulos/horometros/servicios/asignaciones-operadores';
import type { DatosCambioOperador } from '../../modulos/horometros/tipos/asignacion-operador';
import { marcarEliminado } from './eliminacion';
import type { ModuloFuente } from './eliminacion';
import { exigirEscritura } from '../../modulos/acceso/servicios/permisos';
import type {
  BaseDatos,
  MapaDatos,
  MapaRegistros,
  Modulo,
  Repositorio,
  Usuario,
} from '../tipos/datos';
import { esquemaBase } from '../validaciones/base-datos';
import { validarRegistro } from './reglas-negocio';
export const claveAlmacenamiento = 'marimba.datos.v1';

function crearBaseInicialVacia(): BaseDatos {
  return {
    maquinarias: [],
    horometros: [],
    combustible: [],
    'control-diario': [],
    mantenimientos: [],
    asignacionesOperadores: [],
    catalogos: [],
    importacionesCatalogos: [],
  };
}

export class RepositorioLocal implements Repositorio {
  constructor(private readonly crearDatosIniciales: () => BaseDatos = crearBaseInicialVacia) {}

  async registrarMantenimiento(datos: DatosMantenimiento, usuario: Usuario, base: BaseDatos) {
    this.comprobarVersion(base);
    const servicio = crearMantenimiento(datos, base, usuario);
    localStorage.setItem(
      claveAlmacenamiento,
      JSON.stringify({ ...base, mantenimientos: [...(base.mantenimientos ?? []), servicio] }),
    );
    return servicio;
  }
  async guardarCatalogos(carga: CargaCatalogos, usuario: Usuario, base: BaseDatos) {
    this.comprobarVersion(base);
    const siguiente = aplicarCargaCatalogos(carga, base, usuario);
    localStorage.setItem(claveAlmacenamiento, JSON.stringify(siguiente));
    return siguiente;
  }
  private huella(valor: unknown) {
    const base = esquemaBase.parse(valor);
    return JSON.stringify(
      esquemaBase.parse({ ...base, catalogos: base.catalogos ?? catalogosIniciales(base) }),
    );
  }
  private comprobarVersion(base: BaseDatos) {
    const almacenado = localStorage.getItem(claveAlmacenamiento);
    if (!almacenado || this.huella(JSON.parse(almacenado)) !== this.huella(base))
      throw new Error(
        'Los datos cambiaron en otra pestaña. Cierra el formulario y recarga los datos antes de guardar.',
      );
  }
  async cambiarOperador(
    datos: DatosCambioOperador,
    usuario: Usuario,
    base: BaseDatos,
    referencias?: ReferenciasFormulario,
  ) {
    this.comprobarVersion(base);
    exigirEscritura(usuario, 'maquinarias');
    if (referencias) {
      const preparado = prepararCatalogosFormulario(
        'horometros',
        {
          fechaAsignacion: datos.inicio.slice(0, 10),
          fecha: datos.inicio.slice(0, 10),
          maquinariaId: datos.maquinariaId,
          lecturaInicial: 0,
          lecturaFinal: 0,
          operador: datos.operadorNuevo,
        },
        base,
        usuario,
      );
      base = preparado.base;
      datos = {
        ...datos,
        operadorNuevo: preparado.datos.operador,
        operadorId: preparado.datos.operadorId,
      };
    }
    const asignacionesOperadores = aplicarCambioOperador(datos, usuario, base);
    localStorage.setItem(claveAlmacenamiento, JSON.stringify({ ...base, asignacionesOperadores }));
    return asignacionesOperadores;
  }
  async eliminar<Clave extends ModuloFuente>(
    modulo: Clave,
    id: string,
    usuario: Usuario,
    base: BaseDatos,
  ) {
    this.comprobarVersion(base);
    const registro = marcarEliminado(modulo, id, usuario, base);
    localStorage.setItem(
      claveAlmacenamiento,
      JSON.stringify({
        ...base,
        [modulo]: base[modulo].map((actual) => (actual.id === id ? registro : actual)),
      }),
    );
    return registro;
  }

  async cargar(): Promise<BaseDatos> {
    const almacenado = localStorage.getItem(claveAlmacenamiento);
    if (almacenado) {
      const resultado = esquemaBase.safeParse(JSON.parse(almacenado));
      if (!resultado.success)
        throw new Error(
          'Los datos locales tienen un formato inválido. Conserva una copia del almacenamiento antes de restablecerlo.',
        );
      return {
        ...resultado.data,
        catalogos: resultado.data.catalogos ?? catalogosIniciales(resultado.data),
      };
    }
    const inicial = this.crearDatosIniciales();
    const base = {
      ...inicial,
      catalogos: inicial.catalogos ?? catalogosIniciales(inicial),
    };
    localStorage.setItem(claveAlmacenamiento, JSON.stringify(base));
    return base;
  }
  async guardar<Clave extends Modulo>(
    modulo: Clave,
    datos: MapaDatos[Clave],
    id: string | undefined,
    usuario: Usuario,
    base: BaseDatos,
    referencias?: ReferenciasFormulario,
  ): Promise<MapaRegistros[Clave]> {
    this.comprobarVersion(base);
    exigirEscritura(usuario, modulo);
    if (modulo === 'maquinarias')
      exigirPermisoConsumo(
        datos,
        base.maquinarias.find((registro) => registro.id === id),
        usuario,
      );
    if (referencias) {
      const preparado = prepararCatalogosFormulario(modulo, datos, base, usuario, id, referencias);
      base = preparado.base;
      datos = preparado.datos;
    }
    let validos = validarRegistro(modulo, datos, id, base);
    if (modulo === 'horometros' && 'lecturaInicial' in validos)
      validarCapturaInicial(base, validos, usuario.rol, id);
    const anterior = base[modulo].find((registro) => registro.id === id);
    if (id && (!anterior || anterior.eliminado))
      throw new Error('El registro ya no está disponible. Recarga los datos.');
    const fecha = new Date().toISOString();
    if (modulo === 'maquinarias' && 'numeroEconomico' in validos)
      validos = prepararResidencia(
        validos,
        base.maquinarias.find((r) => r.id === id),
        base,
        usuario,
        fecha,
        referencias?.fechaInicioResidente
          ? instanteFechaResidente(referencias.fechaInicioResidente, new Date(fecha))
          : undefined,
      ) as MapaDatos[Clave];
    const valores = valoresAuditables(validos);
    const anteriores = anterior
      ? Object.fromEntries(
          Object.keys(valores).map((campo) => [
            campo,
            (Reflect.get(anterior, campo) ?? '') as string | number,
          ]),
        )
      : undefined;
    const registro = {
      ...validos,
      id: id ?? crypto.randomUUID(),
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
          accion: anterior ? ('Edición' as const) : ('Creación' as const),
          valores,
          anteriores,
        },
      ],
    } as MapaRegistros[Clave];
    const registros = anterior
      ? base[modulo].map((actual) => (actual.id === id ? registro : actual))
      : [registro, ...base[modulo]];
    localStorage.setItem(claveAlmacenamiento, JSON.stringify({ ...base, [modulo]: registros }));
    return registro;
  }
}
