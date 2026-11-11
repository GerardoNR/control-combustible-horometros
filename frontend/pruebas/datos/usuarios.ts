import { crearCredencial } from '../../src/modulos/acceso/servicios/credenciales';
import type { Usuario } from '../../src/compartido/tipos/datos';
export const usuarios: Usuario[] = [
  {
    id: 'usr-ana',
    nombre: 'Ana Martínez',
    nombreUsuario: 'prueba.admin',
    rol: 'ADMINISTRADOR',
    iniciales: 'AM',
    activo: true,
    permisos: [],
  },
  {
    id: 'usr-lucia',
    nombre: 'Lucía Hernández',
    nombreUsuario: 'prueba.captura',
    rol: 'CAPTURISTA',
    iniciales: 'LH',
    activo: true,
    permisos: ['maquinarias', 'horometros', 'combustible', 'control-diario'],
  },
  {
    id: 'usr-carlos',
    nombre: 'Carlos Ramírez',
    nombreUsuario: 'prueba.restringido',
    rol: 'CAPTURISTA',
    iniciales: 'CR',
    activo: true,
    permisos: ['horometros', 'combustible'],
  },
];

// Estas cuentas existen únicamente dentro de las sesiones aisladas de pruebas.
export const contrasenaPrueba = `Aa1!${crypto.randomUUID()}`;
export async function crearCuentasPrueba(contrasena: string) {
  return Promise.all(usuarios.map(async (usuario) => ({
    ...usuario,
    credencial: await crearCredencial(contrasena),
  })));
}
