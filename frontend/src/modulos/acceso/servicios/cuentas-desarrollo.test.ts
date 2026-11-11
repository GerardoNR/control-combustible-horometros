import { describe, expect, it } from 'vitest';
import { prepararCuentasDesarrollo, claveCuentasDesarrollo } from './cuentas-desarrollo';
import { crearCredencial, verificarCredencial } from './credenciales';
import { crearCuentasPrueba } from '../../../../pruebas/datos/usuarios';
import { esquemaCuentasGuardadas } from '../validaciones/usuario';

function almacenPrueba() {
  const mapa = new Map<string, string>();
  return {
    get length() { return mapa.size; },
    getItem: (clave: string) => mapa.get(clave) ?? null,
    setItem: (clave: string, valor: string) => { mapa.set(clave, valor); },
    removeItem: (clave: string) => { mapa.delete(clave); },
    key: (indice: number) => [...mapa.keys()][indice] ?? null,
    clear: () => mapa.clear(),
  } satisfies Storage;
}
describe('Dos administradores temporales de desarrollo', () => {
  it('conserva las contraseñas y permisos actuales sin exigir la credencial inicial', async () => {
    const almacen = almacenPrueba();
    await prepararCuentasDesarrollo(almacen);
    const cuentas = esquemaCuentasGuardadas.parse(JSON.parse(almacen.getItem(claveCuentasDesarrollo)!));
    cuentas[0].credencial = await crearCredencial('ClavePersonalConservada1!');
    cuentas[0].activo = false;
    const original = JSON.stringify(cuentas);
    almacen.setItem(claveCuentasDesarrollo, original);
    await prepararCuentasDesarrollo(almacen);
    expect(almacen.getItem(claveCuentasDesarrollo)).toBe(original);
    expect(await verificarCredencial('ClavePersonalConservada1!', cuentas[0].credencial)).toBe(true);
  });
  it('configura solo admin1 y admin2 con sal distinta, sin contraseñas almacenadas y sin operaciones', async () => {
    const almacen = almacenPrueba();
    await prepararCuentasDesarrollo(almacen);
    const texto = almacen.getItem(claveCuentasDesarrollo)!;
    const cuentas = esquemaCuentasGuardadas.parse(JSON.parse(texto));
    expect(cuentas.map((cuenta) => cuenta.nombreUsuario)).toEqual(['admin1', 'admin2']);
    expect(cuentas.every((cuenta) => cuenta.rol === 'ADMINISTRADOR' && cuenta.activo)).toBe(true);
    expect(cuentas[0].credencial.sal).not.toBe(cuentas[1].credencial.sal);
    expect(texto).not.toContain('123456781');
    expect(texto).not.toContain('123456782');
    expect(await verificarCredencial('123456781', cuentas[0].credencial)).toBe(true);
    expect(await verificarCredencial('123456782', cuentas[1].credencial)).toBe(true);
    expect(almacen.getItem('marimba.datos.v1')).toBeNull();
    await prepararCuentasDesarrollo(almacen);
    expect(almacen.getItem(claveCuentasDesarrollo)).toBe(texto);
  });
  it('retira las tres cuentas originales solo al comprobar identidad y credencial antigua', async () => {
    const almacen = almacenPrueba();
    const cuentas = await crearCuentasPrueba('Marimba2026!');
    const anteriores = ['ana.admin', 'lucia.captura', 'carlos.captura'];
    almacen.setItem('marimba.usuarios.v1', JSON.stringify(cuentas.map((cuenta, indice) => ({ ...cuenta, nombreUsuario: anteriores[indice] }))));
    await prepararCuentasDesarrollo(almacen);
    expect(almacen.getItem('marimba.usuarios.v1')).toBeNull();
    expect(almacen.length).toBe(1);
  });
  it('no elimina cuentas modificadas o desconocidas ni genera respaldo', async () => {
    const almacen = almacenPrueba();
    const cuentas = await crearCuentasPrueba('OtraClavePropia1!');
    cuentas[0].nombreUsuario = 'ana.admin';
    cuentas[0].credencial = await crearCredencial('ClavePersonal1!');
    const original = JSON.stringify(cuentas);
    almacen.setItem('marimba.usuarios.v1', original);
    await expect(prepararCuentasDesarrollo(almacen)).rejects.toThrow('origen desconocido');
    expect(almacen.getItem('marimba.usuarios.v1')).toBe(original);
    expect(almacen.length).toBe(1);
  });
});
