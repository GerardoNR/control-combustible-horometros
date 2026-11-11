import type { DatosMantenimiento } from '../../modulos/maquinarias/tipos/mantenimiento';
import type { CargaCatalogos, ReferenciasFormulario } from '../catalogos/tipos/catalogo';
import type { DatosCambioOperador } from '../../modulos/horometros/tipos/asignacion-operador';
import type { ModuloFuente } from '../servicios/eliminacion';
import { createContext, useContext } from 'react';
import type { BaseDatos, MapaDatos, MapaRegistros, Modulo, Usuario } from '../tipos/datos';
export interface ContextoDatos {
  registrarMantenimiento: (datos: DatosMantenimiento) => Promise<void>;
  guardarCatalogos: (carga: CargaCatalogos) => Promise<void>;
  cambiarOperador: (datos: DatosCambioOperador) => Promise<void>;
  eliminar: (modulo: ModuloFuente, id: string) => Promise<void>;
  base: BaseDatos;
  usuario: Usuario;
  cargando: boolean;
  error: string;
  recargar: () => Promise<void>;
  guardar: <Clave extends Modulo>(
    modulo: Clave,
    datos: MapaDatos[Clave],
    id?: string,
    referencias?: ReferenciasFormulario,
  ) => Promise<MapaRegistros[Clave]>;
}
export const contextoDatos = createContext<ContextoDatos | null>(null);
export function useDatos() {
  const contexto = useContext(contextoDatos);
  if (!contexto) throw new Error('Falta el proveedor de datos.');
  return contexto;
}
