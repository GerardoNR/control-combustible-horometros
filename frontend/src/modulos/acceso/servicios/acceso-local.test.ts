import { contrasenaPrueba } from '../../../../pruebas/datos/usuarios';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AccesoLocal, claveCuentas, claveSesion } from './acceso-local';
import { usuarios, crearCuentasPrueba } from '../../../../pruebas/datos/usuarios';
import { puedeEscribir, puedeAdministrar, usuarioInvitado } from './permisos';
import { RepositorioLocal } from '../../../compartido/servicios/repositorio-local';
import { RepositorioApi } from '../../../compartido/servicios/repositorio-api';
import type { DatosCuenta } from '../tipos/usuario';
class AlmacenamientoPrueba {
  private datos = new Map<string, string>();
  getItem(clave: string) {
    return this.datos.get(clave) ?? null;
  }
  setItem(clave: string, valor: string) {
    this.datos.set(clave, valor);
  }
  removeItem(clave: string) {
    this.datos.delete(clave);
  }
}
let servicio: AccesoLocal;
const nueva: DatosCuenta = {
  nombre: 'Persona de prueba',
  nombreUsuario: 'prueba.usuario',
  contrasena: 'Cuenta2026!Demo',
  rol: 'CAPTURISTA',
  activo: true,
  permisos: ['horometros'],
};
const entrarAdministrador = () =>
  servicio.iniciarSesion({ nombreUsuario: 'prueba.admin', contrasena: contrasenaPrueba });
beforeEach(async () => {
  vi.stubGlobal('localStorage', new AlmacenamientoPrueba());
  vi.stubGlobal('sessionStorage', new AlmacenamientoPrueba());
  localStorage.setItem(claveCuentas, JSON.stringify(await crearCuentasPrueba(contrasenaPrueba)));
  servicio = new AccesoLocal();
  await servicio.inicializar();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('Acceso local sin precarga', () => {
  it('no crea cuentas ni permite entrar con credenciales de otra instalación', async () => {
    localStorage.removeItem(claveCuentas);
    const limpio = new AccesoLocal();
    await limpio.inicializar();
    expect(localStorage.getItem(claveCuentas)).toBeNull();
    expect(limpio.obtenerSesion()).toBeNull();
    await expect(limpio.iniciarSesion({ nombreUsuario: 'prueba.admin', contrasena: contrasenaPrueba }))
      .rejects.toThrow('incorrectos');
  });
  it('persiste derivados con sal sin contraseñas en claro ni credenciales en el usuario público', async () => {
    const almacenado = localStorage.getItem(claveCuentas)!;
    expect(almacenado).not.toContain(contrasenaPrueba);
    expect(almacenado).not.toContain('contrasena');
    const cuentas: { credencial: { sal: string; derivacion: string } }[] = JSON.parse(almacenado);
    expect(new Set(cuentas.map((cuenta) => cuenta.credencial.sal)).size).toBe(3);
    expect(new Set(cuentas.map((cuenta) => cuenta.credencial.derivacion)).size).toBe(3);
    const usuario = await entrarAdministrador();
    expect(usuario).not.toHaveProperty('credencial');
    expect(servicio.obtenerSesion()?.id).toBe(usuario.id);
    expect(sessionStorage.getItem(claveSesion)).toBe(usuario.id);
  });
  it('valida el acceso y permite cerrar la sesión sin perder datos', async () => {
    await expect(
      servicio.iniciarSesion({ nombreUsuario: 'prueba.admin', contrasena: 'incorrecta' }),
    ).rejects.toThrow('incorrectos');
    await entrarAdministrador();
    servicio.cerrarSesion();
    expect(servicio.obtenerSesion()).toBeNull();
    expect(localStorage.getItem(claveCuentas)).not.toBeNull();
  });
  it('impide administrar usuarios sin una sesión administradora', async () => {
    sessionStorage.setItem(claveSesion, 'invitado');
    expect(servicio.obtenerSesion()).toBeNull();
    expect(sessionStorage.getItem(claveSesion)).toBeNull();
    expect(() => servicio.listarUsuarios()).toThrow('administrador');
    await expect(servicio.guardarUsuario(nueva)).rejects.toThrow('administrador');
    await servicio.iniciarSesion({ nombreUsuario: 'prueba.restringido', contrasena: contrasenaPrueba });
    expect(() => servicio.listarUsuarios()).toThrow('administrador');
  });
  it('crea y edita cuentas, conserva la contraseña al dejarla vacía y normaliza el usuario', async () => {
    await entrarAdministrador();
    const cuenta = await servicio.guardarUsuario({ ...nueva, nombreUsuario: ' PRUEBA.USUARIO ' });
    await servicio.guardarUsuario(
      { ...nueva, nombre: 'Nombre actualizado', contrasena: '' },
      cuenta.id,
    );
    await expect(
      servicio.guardarUsuario({ ...nueva, nombreUsuario: 'PRUEBA.USUARIO' }),
    ).rejects.toThrow('ya está registrado');
    servicio.cerrarSesion();
    const activa = await servicio.iniciarSesion({
      nombreUsuario: 'prueba.usuario',
      contrasena: nueva.contrasena,
    });
    expect(activa.nombre).toBe('Nombre actualizado');
    expect(localStorage.getItem(claveCuentas)).not.toContain(nueva.contrasena);
  });
  it('rechaza contraseñas débiles y cuentas nuevas sin contraseña', async () => {
    await entrarAdministrador();
    await expect(servicio.guardarUsuario({ ...nueva, contrasena: 'corta' })).rejects.toThrow();
    await expect(servicio.guardarUsuario({ ...nueva, contrasena: '' })).rejects.toThrow();
  });
  it('desactiva y reactiva cuentas sin permitir el acceso inactivo', async () => {
    await entrarAdministrador();
    const cuenta = await servicio.guardarUsuario(nueva);
    await servicio.guardarUsuario({ ...nueva, contrasena: '', activo: false }, cuenta.id);
    servicio.cerrarSesion();
    await expect(
      servicio.iniciarSesion({ nombreUsuario: nueva.nombreUsuario, contrasena: nueva.contrasena }),
    ).rejects.toThrow('inactiva');
    await entrarAdministrador();
    await servicio.guardarUsuario({ ...nueva, contrasena: '', activo: true }, cuenta.id);
    const activa = await servicio.iniciarSesion({
      nombreUsuario: nueva.nombreUsuario,
      contrasena: nueva.contrasena,
    });
    expect(activa.activo).toBe(true);
  });
  it('impide al administrador desactivarse o quitarse su propio rol', async () => {
    const usuario = await entrarAdministrador();
    await expect(
      servicio.guardarUsuario({ ...usuario, contrasena: '', activo: false }, usuario.id),
    ).rejects.toThrow('propia cuenta');
    await expect(
      servicio.guardarUsuario({ ...usuario, contrasena: '', rol: 'INVITADO' }, usuario.id),
    ).rejects.toThrow('propia cuenta');
  });
  it('no reemplaza almacenamiento de cuentas corrupto', async () => {
    localStorage.setItem(claveCuentas, 'corrupto');
    await expect(new AccesoLocal().inicializar()).rejects.toThrow('leer las cuentas');
    expect(localStorage.getItem(claveCuentas)).toBe('corrupto');
  });
});
describe('Permisos de acciones', () => {
  it('limita el capturista a sus módulos e impide escrituras de invitados', () => {
    expect(puedeAdministrar(usuarios[0])).toBe(true);
    expect(puedeAdministrar(usuarios[1])).toBe(false);
    expect(puedeEscribir(usuarios[0], 'maquinarias')).toBe(true);
    expect(puedeEscribir(usuarios[2], 'horometros')).toBe(true);
    expect(puedeEscribir(usuarios[2], 'maquinarias')).toBe(false);
    expect(puedeEscribir(usuarioInvitado, 'maquinarias')).toBe(false);
    expect(puedeEscribir({ ...usuarios[0], activo: false }, 'maquinarias')).toBe(false);
  });
  it('rechaza escrituras en repositorios locales y REST aun fuera de los formularios', async () => {
    const local = new RepositorioLocal(crearDemostracion);
    const base = await local.cargar();
    const registro = base.maquinarias[0];
    await expect(
      local.guardar('maquinarias', registro, registro.id, usuarioInvitado, base),
    ).rejects.toThrow('permiso');
    const solicitar = vi.fn();
    vi.stubGlobal('fetch', solicitar);
    const api = new RepositorioApi('https://api.ejemplo.com');
    await expect(
      api.guardar('maquinarias', registro, registro.id, usuarios[2], base),
    ).rejects.toThrow('permiso');
    expect(solicitar).not.toHaveBeenCalled();
  });
});
