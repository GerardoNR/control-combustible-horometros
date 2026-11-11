import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { contextoSesion } from './contexto-sesion';
import { accesoLocal, claveCuentasActivas } from '../servicios/acceso-local';
import type { DatosAcceso, DatosCuenta, Usuario } from '../tipos/usuario';
import { mensajeError } from '../../../compartido/utilidades/formato';
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, cambiarUsuario] = useState<Usuario | null>(null);
  const [cargando, cambiarCarga] = useState(true);
  const [error, cambiarError] = useState('');
  useEffect(() => {
    let vigente = true;
    accesoLocal
      .inicializar()
      .then(() => {
        if (vigente) cambiarUsuario(accesoLocal.obtenerSesion());
      })
      .catch((error: unknown) => {
        if (vigente) cambiarError(mensajeError(error));
      })
      .finally(() => {
        if (vigente) cambiarCarga(false);
      });
    function sincronizar(evento: StorageEvent) {
      if (evento.key === claveCuentasActivas || evento.key === null) {
        try {
          cambiarUsuario(accesoLocal.obtenerSesion());
        } catch (error: unknown) {
          cambiarUsuario(null);
          cambiarError(mensajeError(error));
        }
      }
    }
    window.addEventListener('storage', sincronizar);
    return () => {
      vigente = false;
      window.removeEventListener('storage', sincronizar);
    };
  }, []);
  async function reintentar() {
    cambiarCarga(true);
    cambiarError('');
    try {
      await accesoLocal.inicializar();
      cambiarUsuario(accesoLocal.obtenerSesion());
    } catch (error: unknown) {
      cambiarError(mensajeError(error));
    } finally {
      cambiarCarga(false);
    }
  }
  async function iniciarSesion(datos: DatosAcceso) {
    cambiarUsuario(await accesoLocal.iniciarSesion(datos));
  }
  function cerrarSesion() {
    accesoLocal.cerrarSesion();
    cambiarUsuario(null);
  }
  function verificarSesion() {
    const vigente = accesoLocal.obtenerSesion();
    if (!vigente || vigente.id !== usuario?.id) {
      cambiarUsuario(null);
      throw new Error('La sesión cambió o la cuenta fue desactivada. Ingresa nuevamente.');
    }
    return vigente;
  }
  async function guardarUsuario(datos: DatosCuenta, id?: string) {
    await accesoLocal.guardarUsuario(datos, id);
    cambiarUsuario(accesoLocal.obtenerSesion());
  }
  return (
    <contextoSesion.Provider
      value={{
        usuario,
        cargando,
        error,
        reintentar,
        iniciarSesion,
        cerrarSesion,
        listarUsuarios: () => accesoLocal.listarUsuarios(),
        guardarUsuario,
        verificarSesion,
      }}
    >
      {children}
    </contextoSesion.Provider>
  );
}
