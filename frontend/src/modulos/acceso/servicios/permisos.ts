import type { Modulo } from '../../../compartido/tipos/datos';
import type { Usuario } from '../tipos/usuario';
export const modulosDisponibles: { id: Modulo; nombre: string }[] = [
  { id: 'maquinarias', nombre: 'Maquinarias' },
  { id: 'horometros', nombre: 'Horómetros' },
  { id: 'combustible', nombre: 'Combustible' },
  { id: 'control-diario', nombre: 'Control Diario' },
];
export const etiquetasRoles = {
  INVITADO: 'Invitado',
  CAPTURISTA: 'Capturista',
  ADMINISTRADOR: 'Administrador',
};
export const usuarioInvitado: Usuario = {
  id: 'invitado',
  nombre: 'Invitado',
  nombreUsuario: 'invitado',
  rol: 'INVITADO',
  iniciales: 'IN',
  activo: true,
  permisos: [],
};
export function puedeEscribir(usuario: Usuario | null, modulo: Modulo) {
  return (
    !!usuario?.activo &&
    (usuario.rol === 'ADMINISTRADOR' ||
      (usuario.rol === 'CAPTURISTA' && usuario.permisos.includes(modulo)))
  );
}
export function puedeAdministrar(usuario: Usuario | null) {
  return usuario?.activo === true && usuario.rol === 'ADMINISTRADOR';
}
export function exigirEscritura(usuario: Usuario | null, modulo: Modulo) {
  if (!puedeEscribir(usuario, modulo))
    throw new Error('Tu usuario no tiene permiso para registrar o editar en este módulo.');
}
