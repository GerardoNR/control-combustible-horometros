import type {
  DatosMantenimiento,
  Mantenimiento,
} from '../../modulos/maquinarias/tipos/mantenimiento';
import type {
  EntradaCatalogo,
  ImportacionCatalogos,
  CargaCatalogos,
  ReferenciasFormulario,
} from '../catalogos/tipos/catalogo';
import type {
  AsignacionOperador,
  DatosCambioOperador,
} from '../../modulos/horometros/tipos/asignacion-operador';
import type { Maquinaria, DatosMaquinaria } from '../../modulos/maquinarias/tipos/maquinaria';
import type { Horometro, DatosHorometro } from '../../modulos/horometros/tipos/horometro';
import type { Suministro, DatosSuministro } from '../../modulos/combustible/tipos/suministro';
import type { Operacion, DatosOperacion } from '../../modulos/control-diario/tipos/operacion';
import type { ModuloFuente } from '../servicios/eliminacion';
import type { Usuario } from '../../modulos/acceso/tipos/usuario';
export type { Usuario } from '../../modulos/acceso/tipos/usuario';
export interface Cambio {
  fecha: string;
  usuarioId: string;
  usuarioNombre: string;
  accion: 'Creación' | 'Edición' | 'Eliminación';
  valores: Record<string, string | number>;
  anteriores?: Record<string, string | number>;
}
export interface Auditoria {
  eliminado?: boolean;
  id: string;
  creadoEn: string;
  creadoPor: string;
  modificadoEn: string;
  modificadoPor: string;
  historial: Cambio[];
}
export interface MapaRegistros {
  maquinarias: Maquinaria;
  horometros: Horometro;
  combustible: Suministro;
  'control-diario': Operacion;
}
export interface MapaDatos {
  maquinarias: DatosMaquinaria;
  horometros: DatosHorometro;
  combustible: DatosSuministro;
  'control-diario': DatosOperacion;
}
export type Modulo = keyof MapaRegistros;
export type BaseDatos = { [Clave in Modulo]: MapaRegistros[Clave][] } & {
  mantenimientos?: Mantenimiento[];
  asignacionesOperadores?: AsignacionOperador[];
  catalogos?: EntradaCatalogo[];
  importacionesCatalogos?: ImportacionCatalogos[];
};
export interface Repositorio {
  registrarMantenimiento: (
    datos: DatosMantenimiento,
    usuario: Usuario,
    base: BaseDatos,
  ) => Promise<Mantenimiento>;
  guardarCatalogos: (
    carga: CargaCatalogos,
    usuario: Usuario,
    base: BaseDatos,
  ) => Promise<BaseDatos>;
  cambiarOperador: (
    datos: DatosCambioOperador,
    usuario: Usuario,
    base: BaseDatos,
    referencias?: ReferenciasFormulario,
  ) => Promise<AsignacionOperador[]>;
  eliminar: <Clave extends ModuloFuente>(
    modulo: Clave,
    id: string,
    usuario: Usuario,
    base: BaseDatos,
  ) => Promise<MapaRegistros[Clave]>;
  cargar: () => Promise<BaseDatos>;
  guardar: <Clave extends Modulo>(
    modulo: Clave,
    datos: MapaDatos[Clave],
    id: string | undefined,
    usuario: Usuario,
    base: BaseDatos,
    referencias?: ReferenciasFormulario,
  ) => Promise<MapaRegistros[Clave]>;
}
