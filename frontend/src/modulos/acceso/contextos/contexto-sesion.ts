import { createContext, useContext } from 'react';
import type { DatosAcceso, DatosCuenta, Usuario } from '../tipos/usuario';
interface ContextoSesion {
  usuario: Usuario | null;
  cargando: boolean;
  error: string;
  reintentar: () => Promise<void>;
  iniciarSesion: (datos: DatosAcceso) => Promise<void>;
  cerrarSesion: () => void;
  listarUsuarios: () => Usuario[];
  guardarUsuario: (datos: DatosCuenta, id?: string) => Promise<void>;
  verificarSesion: () => Usuario;
}
export const contextoSesion = createContext<ContextoSesion | null>(null);
export function useSesion() {
  const contexto = useContext(contextoSesion);
  if (!contexto) throw new Error('Falta el proveedor de sesión.');
  return contexto;
}
