import type { DatosMantenimiento } from '../../modulos/maquinarias/tipos/mantenimiento';
import type { CargaCatalogos, ReferenciasFormulario } from '../catalogos/tipos/catalogo';
import type { DatosCambioOperador } from '../../modulos/horometros/tipos/asignacion-operador';
import type { ModuloFuente } from '../servicios/eliminacion';
import { useEffect, useRef, useState } from 'react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { contextoDatos } from './contexto-datos';
import type { BaseDatos, MapaDatos, Modulo } from '../tipos/datos';
import { RepositorioLocal, claveAlmacenamiento } from '../servicios/repositorio-local';
import { RepositorioApi } from '../servicios/repositorio-api';
import { useSesion } from '../../modulos/acceso/contextos/contexto-sesion';
import { exigirEscritura } from '../../modulos/acceso/servicios/permisos';
import { mensajeError } from '../utilidades/formato';
const repositorio = import.meta.env.VITE_API_URL
  ? new RepositorioApi(import.meta.env.VITE_API_URL)
  : new RepositorioLocal();
const vacia: BaseDatos = { maquinarias: [], horometros: [], combustible: [], 'control-diario': [] };
export function ProveedorDatos({ children }: { children: ReactNode }) {
  const [base, cambiarBase] = useState<BaseDatos>(vacia);
  const referenciaBase = useRef(base);
  const cargaInicial = useRef<Promise<BaseDatos> | null>(null);
  const guardando = useRef(false);
  const { usuario, verificarSesion } = useSesion();
  const [cargando, cambiarCarga] = useState(true);
  const [error, cambiarError] = useState('');
  const [generacion, cambiarGeneracion] = useState(0);
  useEffect(() => {
    let vigente = true;
    // StrictMode reutiliza la carga durante la comprobación de efectos.
    const carga = (cargaInicial.current ??= repositorio.cargar());
    carga
      .then((datos) => {
        if (!vigente) return;
        referenciaBase.current = datos;
        cambiarBase(datos);
      })
      .catch((error: unknown) => {
        if (vigente) cambiarError(mensajeError(error));
      })
      .finally(() => {
        if (vigente) cambiarCarga(false);
      });
    function sincronizar(evento: StorageEvent) {
      if (
        !import.meta.env.VITE_API_URL &&
        (evento.key === claveAlmacenamiento || evento.key === null)
      )
        void repositorio
          .cargar()
          .then((datos) => {
            if (vigente) {
              referenciaBase.current = datos;
              cambiarBase(datos);
            }
          })
          .catch((error: unknown) => {
            if (vigente) cambiarError(mensajeError(error));
          });
    }
    window.addEventListener('storage', sincronizar);
    return () => {
      window.removeEventListener('storage', sincronizar);
      vigente = false;
    };
  }, []);
  async function recargar() {
    cambiarCarga(true);
    cambiarError('');
    try {
      const datos = await repositorio.cargar();
      referenciaBase.current = datos;
      cambiarBase(datos);
      cambiarGeneracion((actual) => actual + 1);
    } catch (error: unknown) {
      cambiarError(mensajeError(error));
    } finally {
      cambiarCarga(false);
    }
  }
  async function guardar<Clave extends Modulo>(
    modulo: Clave,
    datos: MapaDatos[Clave],
    id?: string,
    referencias: ReferenciasFormulario = {},
  ) {
    const activo = verificarSesion();
    exigirEscritura(activo, modulo);
    if (guardando.current) throw new Error('Espera a que termine el guardado actual.');
    guardando.current = true;
    try {
      const actual = referenciaBase.current;
      const registro = await repositorio.guardar(modulo, datos, id, activo, actual, referencias);
      const siguiente = await repositorio.cargar();
      // Incluye las altas de catálogo confirmadas junto con el registro.
      referenciaBase.current = siguiente;
      cambiarBase(siguiente);
      return registro;
    } finally {
      guardando.current = false;
    }
  }
  async function eliminar(modulo: ModuloFuente, id: string) {
    const activo = verificarSesion();
    exigirEscritura(activo, modulo);
    if (guardando.current) throw new Error('Espera a que termine el guardado actual.');
    guardando.current = true;
    try {
      const actual = referenciaBase.current;
      const registro = await repositorio.eliminar(modulo, id, activo, actual);
      const siguiente = {
        ...actual,
        [modulo]: actual[modulo].map((fila) => (fila.id === id ? registro : fila)),
      };
      referenciaBase.current = siguiente;
      cambiarBase(siguiente);
    } finally {
      guardando.current = false;
    }
  }
  async function guardarCatalogos(carga: CargaCatalogos) {
    const activo = verificarSesion();
    if (guardando.current) throw new Error('Espera a que termine el guardado actual.');
    guardando.current = true;
    try {
      const siguiente = await repositorio.guardarCatalogos(carga, activo, referenciaBase.current);
      referenciaBase.current = siguiente;
      cambiarBase(siguiente);
    } finally {
      guardando.current = false;
    }
  }
  async function cambiarOperador(datos: DatosCambioOperador) {
    const activo = verificarSesion();
    exigirEscritura(activo, 'maquinarias');
    if (guardando.current) throw new Error('Espera a que termine el guardado actual.');
    guardando.current = true;
    try {
      const actual = referenciaBase.current;
      const asignacionesOperadores = await repositorio.cambiarOperador(datos, activo, actual, {});
      const siguiente = { ...(await repositorio.cargar()), asignacionesOperadores };
      referenciaBase.current = siguiente;
      cambiarBase(siguiente);
    } finally {
      guardando.current = false;
    }
  }
  async function registrarMantenimiento(datos: DatosMantenimiento) {
    const activo = verificarSesion();
    exigirEscritura(activo, 'maquinarias');
    if (guardando.current) throw new Error('Espera a que termine el guardado actual.');
    guardando.current = true;
    try {
      const actual = referenciaBase.current;
      const servicio = await repositorio.registrarMantenimiento(datos, activo, actual);
      const siguiente = { ...actual, mantenimientos: [...(actual.mantenimientos ?? []), servicio] };
      referenciaBase.current = siguiente;
      cambiarBase(siguiente);
    } finally {
      guardando.current = false;
    }
  }
  if (!usuario) return null;
  return (
    <contextoDatos.Provider
      value={{
        base,
        usuario,
        cargando,
        error,
        recargar,
        guardar,
        guardarCatalogos,
        registrarMantenimiento,
        cambiarOperador,
        eliminar,
      }}
    >
      <Fragment key={generacion}>{children}</Fragment>
    </contextoDatos.Provider>
  );
}
