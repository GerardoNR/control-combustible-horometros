import { contrasenaPrueba } from './datos/usuarios';
import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
export async function prepararCuentasPrueba(pagina: Page) {
  await expect(pagina.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
  await pagina.evaluate(async (contrasena) => {
    if (JSON.parse(localStorage.getItem('marimba.usuarios.v1') ?? '[]').length) return;
    const ruta = '/pruebas/datos/usuarios.ts';
    const { crearCuentasPrueba } = await import(/* @vite-ignore */ ruta);
    localStorage.setItem(
      'marimba.usuarios.v1',
      JSON.stringify(await crearCuentasPrueba(contrasena)),
    );
  }, contrasenaPrueba);
}
export async function iniciarSesion(
  pagina: Page,
  nombreUsuario = 'prueba.admin',
  contrasena = contrasenaPrueba,
  conservarMuestra = false,
) {
  await prepararCuentasPrueba(pagina);
  if (!conservarMuestra)
    await pagina.evaluate(async () => {
      const almacenados = localStorage.getItem('marimba.datos.v1');
      const base = almacenados ? JSON.parse(almacenados) : null;
      const sinRegistros =
        !base ||
        ['maquinarias', 'horometros', 'combustible'].every(
          (modulo) => !Array.isArray(base[modulo]) || base[modulo].length === 0,
        );
      if (sinRegistros) {
        const rutaFixture = '/pruebas/datos/operaciones-legadas.ts';
        const { crearDemostracion } = await import(/* @vite-ignore */ rutaFixture);
        localStorage.setItem('marimba.datos.v1', JSON.stringify(crearDemostracion()));
      }
    });
  await pagina.getByLabel('Usuario', { exact: true }).fill(nombreUsuario);
  await pagina.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  await pagina.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(pagina.locator('#selector-usuario')).toBeVisible();
}

export async function iniciarSesionConMuestraCompleta(
  pagina: Page,
  nombreUsuario = 'prueba.admin',
  contrasena = contrasenaPrueba,
) {
  await pagina.evaluate(async () => {
    const rutaFixture = '/pruebas/datos/operaciones-completas.ts';
    const modulo = await import(/* @vite-ignore */ rutaFixture);
    localStorage.setItem('marimba.datos.v1', JSON.stringify(modulo.crearMuestraFicticia()));
  });
  await iniciarSesion(pagina, nombreUsuario, contrasena, true);
}
export async function cerrarSesion(pagina: Page) {
  await pagina.locator('#selector-usuario').click();
  await pagina.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(pagina.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
}
export async function navegar(pagina: Page, informacion: TestInfo, nombre: string) {
  if (informacion.project.name !== 'escritorio')
    await pagina.getByRole('button', { name: 'Abrir menú' }).click();
  await pagina
    .getByRole('navigation', { name: 'Navegación principal' })
    .filter({ visible: true })
    .getByRole('link', { name: nombre, exact: true })
    .click();
  await expect(pagina.getByRole('heading', { name: nombre, exact: true })).toBeVisible();
  if (informacion.project.name !== 'escritorio')
    await expect(pagina.getByRole('dialog', { name: 'Menú de navegación' })).toBeHidden();
}
export async function administrar(pagina: Page) {
  await pagina.locator('#selector-usuario').click();
  await pagina.getByRole('button', { name: 'Administrar usuarios', exact: true }).click();
  await expect(
    pagina.getByRole('dialog', { name: 'Administración de usuarios', exact: true }),
  ).toBeVisible();
}

export async function iniciarConsulta(pagina: Page) {
  await prepararCuentasPrueba(pagina);
  await expect(pagina.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
  await pagina.evaluate(() => {
    const cuentas = JSON.parse(localStorage.getItem('marimba.usuarios.v1')!);
    if (!cuentas.some((cuenta: { id: string }) => cuenta.id === 'consulta-autenticada')) {
      cuentas.push({
        ...cuentas[0],
        id: 'consulta-autenticada',
        nombre: 'Consulta autenticada',
        nombreUsuario: 'consulta.prueba',
        rol: 'INVITADO',
        iniciales: 'CA',
        permisos: [],
      });
      localStorage.setItem('marimba.usuarios.v1', JSON.stringify(cuentas));
    }
  });
  await iniciarSesion(pagina, 'consulta.prueba');
}

export async function confirmarCambios(pagina: Page) {
  if (await pagina.getByRole('listbox', { name: 'Opciones disponibles' }).isVisible())
    await pagina.keyboard.press('Escape');
  const confirmacion = pagina.getByLabel('Confirmo el cambio y conservo el historial anterior', {
    exact: true,
  });
  for (const casilla of await confirmacion.all()) {
    if (await casilla.isVisible()) await casilla.check();
  }
}
