import { exigirPermisoConsumo } from '../../modulos/control-diario/servicios/evaluacion-consumo';
import { valoresAuditables } from '../utilidades/auditoria';
import { prepararCatalogosFormulario } from '../catalogos/servicios/catalogos-formulario';
import type { ReferenciasFormulario } from '../catalogos/tipos/catalogo';
import { validarMantenimiento } from '../../modulos/maquinarias/servicios/mantenimiento';
import { esquemaRegistroMantenimiento } from '../validaciones/base-datos';
import type { DatosMantenimiento } from '../../modulos/maquinarias/tipos/mantenimiento';
import { validarCapturaInicial } from './captura-diaria';
import type { CargaCatalogos } from '../catalogos/tipos/catalogo';
import { aplicarCargaCatalogos } from '../catalogos/servicios/catalogos';
import type { DatosCambioOperador } from '../../modulos/horometros/tipos/asignacion-operador';
import { validarCambioOperador } from '../../modulos/horometros/servicios/asignaciones-operadores';
import { esquemaAsignacionesOperadores } from '../../modulos/horometros/validaciones/asignacion-operador';
import { z } from 'zod';
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
import { esquemaBase, esquemasRegistros } from '../validaciones/base-datos';
import { validarRegistro } from './reglas-negocio';
export class RepositorioApi implements Repositorio {
  async registrarMantenimiento(datos: DatosMantenimiento, usuario: Usuario, base: BaseDatos) {
    const validos = validarMantenimiento(datos, base, usuario);
    if (!this.revision || this.huella !== this.identificar(base))
      throw new Error('Recarga los datos antes de registrar el servicio.');
    const respuesta = await this.solicitar('/mantenimientos', {
      method: 'POST',
      body: JSON.stringify(validos),
      headers: { 'X-Usuario-Demo': usuario.id, 'If-Match': this.revision },
    });
    const resultado = z
      .object({ revision: z.string().min(1), registro: esquemaRegistroMantenimiento })
      .parse(respuesta);
    if (
      !resultado.registro.id ||
      resultado.registro.eliminado ||
      resultado.registro.maquinariaId !== validos.maquinariaId ||
      resultado.registro.fecha !== validos.fecha ||
      resultado.registro.lecturaHorometro !== validos.lecturaHorometro ||
      resultado.registro.tipoServicio !== validos.tipoServicio ||
      (base.mantenimientos ?? []).some((r) => r.id === resultado.registro.id)
    )
      throw new Error('El servidor devolvió un mantenimiento incompatible. Recarga los datos.');
    this.huella = this.identificar({
      ...base,
      mantenimientos: [...(base.mantenimientos ?? []), resultado.registro],
    });
    this.revision = resultado.revision;
    return resultado.registro;
  }
  private revision?: string;
  private huella?: string;
  private identificar(base: BaseDatos) {
    return JSON.stringify(esquemaBase.parse(base));
  }
  constructor(private readonly url: string) {}
  private async solicitar(ruta: string, opciones?: RequestInit): Promise<unknown> {
    const respuesta = await fetch(`${this.url.replace(/\/$/, '')}${ruta}`, {
      ...opciones,
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...opciones?.headers },
    });
    if (respuesta.status === 409 || respuesta.status === 412)
      throw new Error(
        'Los datos cambiaron en el servidor. Cierra el formulario y recarga los datos antes de continuar.',
      );
    if (!respuesta.ok)
      throw new Error(
        `No se pudo completar la solicitud (${respuesta.status}). Revisa la conexión con el servidor.`,
      );
    return respuesta.json();
  }
  private async escribir<Clave extends Modulo>(
    modulo: Clave,
    ruta: string,
    metodo: string,
    usuario: Usuario,
    base: BaseDatos,
    datos?: MapaDatos[Clave],
    id?: string,
    referencias?: ReferenciasFormulario,
  ) {
    if (!this.revision || this.huella !== this.identificar(base))
      throw new Error('Recarga los datos para obtener una revisión consistente antes de guardar.');
    const respuesta = await this.solicitar(ruta, {
      method: metodo,
      body: datos
        ? JSON.stringify(
            modulo === 'maquinarias' &&
            (referencias?.residente || referencias?.fechaInicioResidente)
              ? { datos, referencias }
              : datos,
          )
        : undefined,
      headers: { 'X-Usuario-Demo': usuario.id, 'If-Match': this.revision },
    });
    const resultado = z
      .object({ revision: z.string().min(1), registro: z.unknown() })
      .parse(respuesta);
    const registro = esquemasRegistros[modulo].parse(resultado.registro) as MapaRegistros[Clave];
    if (
      !registro.id ||
      (id ? registro.id !== id : base[modulo].some((actual) => actual.id === registro.id)) ||
      (metodo === 'DELETE' && !registro.eliminado)
    )
      throw new Error('El servidor devolvió un registro incompatible. Recarga los datos.');
    const registros = id
      ? base[modulo].map((actual) => (actual.id === id ? registro : actual))
      : [registro, ...base[modulo]];
    this.huella = this.identificar({ ...base, [modulo]: registros });
    this.revision = resultado.revision;
    return registro;
  }
  async guardarCatalogos(carga: CargaCatalogos, usuario: Usuario, base: BaseDatos) {
    aplicarCargaCatalogos(carga, base, usuario);
    if (!this.revision || this.huella !== this.identificar(base))
      throw new Error('Recarga los datos antes de gestionar catálogos.');
    const respuesta = await this.solicitar('/catalogos/cargas', {
      method: 'POST',
      body: JSON.stringify(carga),
      headers: { 'X-Usuario-Demo': usuario.id, 'If-Match': this.revision },
    });
    const resultado = z
      .object({ revision: z.string().min(1), datos: esquemaBase })
      .parse(respuesta);
    this.revision = resultado.revision;
    this.huella = this.identificar(resultado.datos);
    return resultado.datos;
  }
  async cargar(): Promise<BaseDatos> {
    const respuesta = await this.solicitar('/operaciones/snapshot');
    const resultado = z
      .object({ revision: z.string().min(1), datos: esquemaBase })
      .parse(respuesta);
    this.huella = this.identificar(resultado.datos);
    this.revision = resultado.revision;
    return resultado.datos;
  }
  async cambiarOperador(
    datos: DatosCambioOperador,
    usuario: Usuario,
    base: BaseDatos,
    referencias?: ReferenciasFormulario,
  ) {
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
      datos = {
        ...datos,
        operadorNuevo: preparado.datos.operador,
        operadorId: preparado.datos.operadorId,
      };
      validarCambioOperador(datos, preparado.base);
      if (JSON.stringify(preparado.base.catalogos) !== JSON.stringify(base.catalogos)) {
        const siguiente = await this.guardarAtomico(
          '/asignaciones-operadores/cambios-con-catalogos',
          {
            datos,
            entradasNuevas: preparado.base.catalogos.filter(
              (entrada) => !base.catalogos?.some((anterior) => anterior.id === entrada.id),
            ),
          },
          usuario,
          base,
          (siguiente) => {
            if (
              (base.asignacionesOperadores ?? []).some(
                (anterior) =>
                  !siguiente.asignacionesOperadores?.some((actual) => actual.id === anterior.id),
              ) ||
              JSON.stringify(base.horometros) !== JSON.stringify(siguiente.horometros) ||
              JSON.stringify(base.combustible) !== JSON.stringify(siguiente.combustible)
            )
              throw new Error('La respuesta no conserva los datos históricos. Recarga los datos.');
          },
        );
        if (
          (base.asignacionesOperadores ?? []).some(
            (anterior) =>
              !siguiente.asignacionesOperadores?.some((actual) => actual.id === anterior.id),
          )
        )
          throw new Error(
            'La respuesta no conserva el historial de asignaciones. Recarga los datos.',
          );
        return siguiente.asignacionesOperadores ?? [];
      }
    }
    const { validos } = validarCambioOperador(datos, base);
    if (!this.revision || this.huella !== this.identificar(base))
      throw new Error(
        'Recarga los datos para obtener una revisión consistente antes de cambiar la asignación.',
      );
    const respuesta = await this.solicitar('/asignaciones-operadores/cambios', {
      method: 'POST',
      body: JSON.stringify(validos),
      headers: { 'X-Usuario-Demo': usuario.id, 'If-Match': this.revision },
    });
    const resultado = z
      .object({
        revision: z.string().min(1),
        asignacionesOperadores: esquemaAsignacionesOperadores,
      })
      .parse(respuesta);
    if (
      (base.asignacionesOperadores ?? []).some(
        (anterior) => !resultado.asignacionesOperadores.some((actual) => actual.id === anterior.id),
      )
    )
      throw new Error('La respuesta no conserva el historial de asignaciones. Recarga los datos.');
    this.huella = this.identificar({
      ...base,
      asignacionesOperadores: resultado.asignacionesOperadores,
    });
    this.revision = resultado.revision;
    return resultado.asignacionesOperadores;
  }
  async eliminar<Clave extends ModuloFuente>(
    modulo: Clave,
    id: string,
    usuario: Usuario,
    base: BaseDatos,
  ) {
    marcarEliminado(modulo, id, usuario, base);
    const registro = await this.escribir(
      modulo,
      `/${modulo}/${encodeURIComponent(id)}`,
      'DELETE',
      usuario,
      base,
      undefined,
      id,
    );
    if (!registro.eliminado || registro.id !== id)
      throw new Error('El servidor no confirmó la eliminación del registro. Recarga los datos.');
    return registro;
  }
  private async guardarAtomico(
    ruta: string,
    datos: object,
    usuario: Usuario,
    base: BaseDatos,
    comprobar: (siguiente: BaseDatos) => void,
  ) {
    if (!this.revision || this.huella !== this.identificar(base))
      throw new Error('Recarga los datos antes de guardar.');
    // El contrato requiere transacción; no se crean catálogos mediante solicitudes separadas.
    const respuesta = await this.solicitar(ruta, {
      method: 'POST',
      body: JSON.stringify(datos),
      headers: { 'X-Usuario-Demo': usuario.id, 'If-Match': this.revision },
    });
    const resultado = z
      .object({ revision: z.string().min(1), datos: esquemaBase })
      .parse(respuesta);
    for (const entrada of base.catalogos ?? []) {
      if (
        !resultado.datos.catalogos?.some(
          (actual) => JSON.stringify(actual) === JSON.stringify(entrada),
        )
      )
        throw new Error('La respuesta no conserva los catálogos anteriores. Recarga los datos.');
    }
    const altas: unknown = Reflect.get(datos, 'entradasNuevas');
    if (
      Array.isArray(altas) &&
      altas.some(
        (entrada) =>
          !resultado.datos.catalogos?.some(
            (actual) =>
              actual.id === entrada.id &&
              actual.tipo === entrada.tipo &&
              actual.nombre === entrada.nombre &&
              actual.codigo === entrada.codigo,
          ),
      )
    )
      throw new Error('El servidor no confirmó las altas del catálogo. Recarga los datos.');
    comprobar(resultado.datos);
    this.huella = this.identificar(resultado.datos);
    this.revision = resultado.revision;
    return resultado.datos;
  }
  async guardar<Clave extends Modulo>(
    modulo: Clave,
    datos: MapaDatos[Clave],
    id: string | undefined,
    usuario: Usuario,
    base: BaseDatos,
    referencias?: ReferenciasFormulario,
  ): Promise<MapaRegistros[Clave]> {
    exigirEscritura(usuario, modulo);
    if (modulo === 'maquinarias')
      exigirPermisoConsumo(
        datos,
        base.maquinarias.find((registro) => registro.id === id),
        usuario,
      );
    if (referencias) {
      const preparado = prepararCatalogosFormulario(modulo, datos, base, usuario, id, referencias);
      const validos = validarRegistro(modulo, preparado.datos, id, preparado.base);
      if (modulo === 'horometros' && 'lecturaInicial' in validos)
        validarCapturaInicial(preparado.base, validos, usuario.rol, id);
      if (JSON.stringify(preparado.base.catalogos) !== JSON.stringify(base.catalogos)) {
        const siguiente = await this.guardarAtomico(
          '/operaciones/guardar-con-catalogos',
          {
            modulo,
            datos: validos,
            ...(modulo === 'maquinarias' &&
            (referencias?.residente || referencias?.fechaInicioResidente)
              ? { referencias }
              : {}),
            id,
            entradasNuevas: preparado.base.catalogos.filter(
              (entrada) => !base.catalogos?.some((anterior) => anterior.id === entrada.id),
            ),
          },
          usuario,
          base,
          (siguiente) => {
            const seleccionado = siguiente[modulo].find((actual) =>
              id ? actual.id === id : !base[modulo].some((anterior) => anterior.id === actual.id),
            );
            if (
              !seleccionado ||
              seleccionado.eliminado ||
              Object.entries(valoresAuditables(validos)).some(
                ([campo, valor]) => Reflect.get(seleccionado, campo) !== valor,
              )
            )
              throw new Error('El servidor devolvió un registro incompatible. Recarga los datos.');
            for (const clave of [
              'maquinarias',
              'horometros',
              'combustible',
              'control-diario',
            ] as const)
              for (const anterior of base[clave]) {
                const actual = siguiente[clave].find((registro) => registro.id === anterior.id);
                if (
                  !actual ||
                  (clave === modulo && anterior.id === id
                    ? JSON.stringify(actual.historial.slice(0, anterior.historial.length)) !==
                      JSON.stringify(anterior.historial)
                    : JSON.stringify(actual) !== JSON.stringify(anterior))
                )
                  throw new Error(
                    'La respuesta no conserva los registros anteriores. Recarga los datos.',
                  );
              }
          },
        );
        const registro = siguiente[modulo].find((actual) =>
          id ? actual.id === id : !base[modulo].some((anterior) => anterior.id === actual.id),
        );
        if (!registro || registro.eliminado)
          throw new Error('El servidor no confirmó el registro. Recarga los datos.');
        return registro as MapaRegistros[Clave];
      }
      datos = validos;
    }
    const validos = validarRegistro(modulo, datos, id, base);
    if (modulo === 'horometros' && 'lecturaInicial' in validos)
      validarCapturaInicial(base, validos, usuario.rol, id);
    return this.escribir(
      modulo,
      `/${modulo}${id ? `/${encodeURIComponent(id)}` : ''}`,
      id ? 'PUT' : 'POST',
      usuario,
      base,
      validos,
      id,
      referencias,
    );
  }
}
