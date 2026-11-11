import type { Cuenta, DatosAcceso, DatosCuenta, ServicioAcceso, Usuario } from '../tipos/usuario';
import {
  esquemaAcceso,
  esquemaCuenta,
  esquemaContrasena,
  esquemaCuentasGuardadas,
} from '../validaciones/usuario';
import { crearCredencial, verificarCredencial } from './credenciales';
import { puedeAdministrar } from './permisos';
export const claveCuentas = 'marimba.usuarios.v1';
export const claveSesion = 'marimba.sesion.v1';

export class AccesoLocal implements ServicioAcceso {
  constructor(
    private readonly claveAlmacenamiento = claveCuentas,
    private readonly prepararEntorno?: () => Promise<void>,
    private readonly almacenamientoInyectado?: Storage,
    private readonly sesionInyectada?: Storage,
  ) {}

  private get almacenamiento(): Storage {
    return this.almacenamientoInyectado ?? localStorage;
  }

  private get almacenamientoSesion(): Storage {
    return this.sesionInyectada ?? sessionStorage;
  }

  private inicializacion?: Promise<void>;
  inicializar() {
    if (!this.inicializacion)
      this.inicializacion = this.preparar().catch((error) => {
        this.inicializacion = undefined;
        throw error;
      });
    return this.inicializacion;
  }
  private async preparar() {
    await this.prepararEntorno?.();
    if (this.almacenamiento.getItem(this.claveAlmacenamiento) !== null) {
      this.leerCuentas();
      return;
    }
  }
  private leerCuentas(): Cuenta[] {
    try {
      return esquemaCuentasGuardadas.parse(JSON.parse(this.almacenamiento.getItem(this.claveAlmacenamiento) ?? '[]'));
    } catch {
      throw new Error(
        'No se pudieron leer las cuentas locales. Conserva una copia del almacenamiento antes de restablecerlo.',
      );
    }
  }
  private publico(cuenta: Cuenta): Usuario {
    return {
      id: cuenta.id,
      nombre: cuenta.nombre,
      nombreUsuario: cuenta.nombreUsuario,
      rol: cuenta.rol,
      iniciales: cuenta.iniciales,
      activo: cuenta.activo,
      permisos: [...cuenta.permisos],
    };
  }
  obtenerSesion(): Usuario | null {
    const id = this.almacenamientoSesion.getItem(claveSesion);
    const cuenta = this.leerCuentas().find((cuenta) => cuenta.id === id && cuenta.activo);
    if (!cuenta) {
      this.almacenamientoSesion.removeItem(claveSesion);
      return null;
    }
    return this.publico(cuenta);
  }
  async iniciarSesion(datos: DatosAcceso) {
    const validos = esquemaAcceso.parse(datos);
    const cuenta = this.leerCuentas().find(
      (cuenta) => cuenta.nombreUsuario === validos.nombreUsuario.toLowerCase(),
    );
    if (
      !cuenta ||
      !cuenta.activo ||
      !(await verificarCredencial(validos.contrasena, cuenta.credencial))
    )
      throw new Error('Usuario o contraseña incorrectos, o cuenta inactiva.');
    const vigente = this.leerCuentas().find((actual) => actual.id === cuenta.id && actual.activo);
    if (!vigente || vigente.credencial.derivacion !== cuenta.credencial.derivacion)
      throw new Error('La cuenta cambió durante el acceso. Intenta nuevamente.');
    this.almacenamientoSesion.setItem(claveSesion, cuenta.id);
    return this.publico(vigente);
  }
  cerrarSesion() {
    this.almacenamientoSesion.removeItem(claveSesion);
  }
  private exigirAdministrador() {
    const usuario = this.obtenerSesion();
    if (!usuario || !puedeAdministrar(usuario))
      throw new Error('Solo un administrador activo puede gestionar usuarios.');
    return usuario;
  }
  listarUsuarios() {
    this.exigirAdministrador();
    return this.leerCuentas().map((cuenta) => this.publico(cuenta));
  }
  async guardarUsuario(datos: DatosCuenta, id?: string) {
    const actor = this.exigirAdministrador();
    if (this.claveAlmacenamiento === 'marimba.usuarios.desarrollo.v1')
      throw new Error('Las dos cuentas temporales de desarrollo no se administran desde la aplicación.');
    const validos = esquemaCuenta.parse(datos);
    if (!id) esquemaContrasena.parse(validos.contrasena);
    const cuentas = this.leerCuentas();
    const anterior = cuentas.find((cuenta) => cuenta.id === id);
    if (id && !anterior) throw new Error('La cuenta ya no está disponible. Recarga los usuarios.');
    if (
      cuentas.some((cuenta) => cuenta.id !== id && cuenta.nombreUsuario === validos.nombreUsuario)
    )
      throw new Error('Este nombre de usuario ya está registrado.');
    if (id === actor.id && (!validos.activo || validos.rol !== 'ADMINISTRADOR'))
      throw new Error('No puedes desactivar tu propia cuenta ni quitarte el rol de administrador.');
    const instantanea = this.almacenamiento.getItem(this.claveAlmacenamiento);
    const credencial = validos.contrasena
      ? await crearCredencial(validos.contrasena)
      : anterior?.credencial;
    if (!credencial) throw new Error('Ingresa una contraseña para crear la cuenta.');
    this.exigirAdministrador();
    if (this.almacenamiento.getItem(this.claveAlmacenamiento) !== instantanea)
      throw new Error(
        'Las cuentas cambiaron en otra pestaña. Recarga los usuarios antes de guardar.',
      );
    const cuenta: Cuenta = {
      id: id ?? crypto.randomUUID(),
      nombre: validos.nombre,
      nombreUsuario: validos.nombreUsuario,
      rol: validos.rol,
      activo: validos.activo,
      permisos: validos.rol === 'CAPTURISTA' ? [...new Set(validos.permisos)] : [],
      iniciales: validos.nombre
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte[0])
        .join('')
        .toUpperCase(),
      credencial,
    };
    this.almacenamiento.setItem(
      this.claveAlmacenamiento,
      JSON.stringify(
        id ? cuentas.map((actual) => (actual.id === id ? cuenta : actual)) : [...cuentas, cuenta],
      ),
    );
    return this.publico(cuenta);
  }
}
const desarrolloLocal = import.meta.env.DEV && import.meta.env.MODE !== 'pruebas' && !import.meta.env.VITE_API_URL;
export const claveCuentasActivas = desarrolloLocal ? 'marimba.usuarios.desarrollo.v1' : claveCuentas;
export const accesoLocal = new AccesoLocal(claveCuentasActivas, desarrolloLocal ? async () => {
  const { prepararCuentasDesarrollo } = await import('./cuentas-desarrollo');
  await prepararCuentasDesarrollo();
} : undefined);
