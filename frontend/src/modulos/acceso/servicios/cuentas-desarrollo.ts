import type { Cuenta } from '../tipos/usuario';
import { crearCredencial, verificarCredencial } from './credenciales';
import { esquemaCuentasGuardadas } from '../validaciones/usuario';

export const claveCuentasDesarrollo = 'marimba.usuarios.desarrollo.v1';
const administradores = [
  { nombreUsuario: 'admin1', contrasena: '123456781' },
  { nombreUsuario: 'admin2', contrasena: '123456782' },
];
const anteriores = [
  ['usr-ana', 'ana.admin', 'Ana Martínez', 'ADMINISTRADOR'],
  ['usr-lucia', 'lucia.captura', 'Lucía Hernández', 'CAPTURISTA'],
  ['usr-carlos', 'carlos.captura', 'Carlos Ramírez', 'CAPTURISTA'],
];
async function retirarCuentasAnteriores(almacen: Storage) {
  const original = almacen.getItem('marimba.usuarios.v1');
  if (!original) return;
  let cuentas: Cuenta[];
  try { cuentas = esquemaCuentasGuardadas.parse(JSON.parse(original)); } catch {
    throw new Error('Hay cuentas anteriores de origen desconocido. Revisa su procedencia y solicita confirmación antes de eliminarlas.');
  }
  for (const cuenta of cuentas) {
    const conocida = anteriores.some(([id, usuario, nombre, rol]) => cuenta.id === id &&
      cuenta.nombreUsuario === usuario && cuenta.nombre === nombre && cuenta.rol === rol);
    // La contraseña anterior se usa únicamente para reconocer la precarga retirada.
    if (!conocida || !(await verificarCredencial('Marimba2026!', cuenta.credencial)))
      throw new Error('Hay cuentas anteriores modificadas o de origen desconocido. Se conservaron para revisión y confirmación.');
  }
  if (almacen.getItem('marimba.usuarios.v1') !== original)
    throw new Error('Las cuentas cambiaron durante la transición. Recarga antes de continuar.');
  almacen.removeItem('marimba.usuarios.v1');
}

export async function prepararCuentasDesarrollo(almacen: Storage = localStorage) {
  await retirarCuentasAnteriores(almacen);
  const original = almacen.getItem(claveCuentasDesarrollo);
  if (original !== null) {
    let cuentas: Cuenta[];
    try { cuentas = esquemaCuentasGuardadas.parse(JSON.parse(original)); } catch {
      throw new Error('Las cuentas de desarrollo requieren revisión. No se sobrescribieron.');
    }
    if (cuentas.length !== 2 || new Set(cuentas.map((cuenta) => cuenta.nombreUsuario)).size !== 2)
      throw new Error('Hay cuentas de desarrollo no identificadas. Revisa y confirma antes de eliminarlas.');
    for (const cuenta of cuentas) {
      const esperada = administradores.find((admin) => admin.nombreUsuario === cuenta.nombreUsuario);
      if (!esperada || cuenta.id !== `desarrollo-${esperada.nombreUsuario}`)
        throw new Error('Hay cuentas de desarrollo no identificadas. Se conservaron para revisión.');
    }
    // Las credenciales y permisos existentes se conservan, aunque hayan cambiado.
  } else {
    const cuentas: Cuenta[] = await Promise.all(administradores.map(async (admin) => ({
      id: `desarrollo-${admin.nombreUsuario}`,
      nombre: `Administrador local ${admin.nombreUsuario}`,
      nombreUsuario: admin.nombreUsuario,
      rol: 'ADMINISTRADOR',
      iniciales: admin.nombreUsuario === 'admin1' ? 'A1' : 'A2',
      activo: true,
      permisos: [],
      credencial: await crearCredencial(admin.contrasena),
    })));
    if (almacen.getItem(claveCuentasDesarrollo) !== original)
      throw new Error('Las cuentas cambiaron durante la preparación. Recarga antes de continuar.');
    almacen.setItem(claveCuentasDesarrollo, JSON.stringify(cuentas));
  }
}
