import type { Modulo } from '../../../compartido/tipos/datos';
export type Rol = 'INVITADO' | 'CAPTURISTA' | 'ADMINISTRADOR';
export interface Usuario {
  id: string;
  nombre: string;
  nombreUsuario: string;
  rol: Rol;
  iniciales: string;
  activo: boolean;
  permisos: Modulo[];
}
export interface Credencial {
  sal: string;
  derivacion: string;
  iteraciones: number;
}
export interface Cuenta extends Usuario {
  credencial: Credencial;
}
export interface DatosCuenta {
  nombre: string;
  nombreUsuario: string;
  contrasena: string;
  rol: Rol;
  activo: boolean;
  permisos: Modulo[];
}
export interface DatosAcceso {
  nombreUsuario: string;
  contrasena: string;
}
export interface ServicioAcceso {
  inicializar: () => Promise<void>;
  obtenerSesion: () => Usuario | null;
  iniciarSesion: (datos: DatosAcceso) => Promise<Usuario>;
  cerrarSesion: () => void;
  listarUsuarios: () => Usuario[];
  guardarUsuario: (datos: DatosCuenta, id?: string) => Promise<Usuario>;
}
