import { contrasenaPrueba } from './datos/usuarios';
import { confirmarCambios } from './ayudantes';
import { test, expect } from '@playwright/test';
import { iniciarSesion, cerrarSesion, navegar, administrar, iniciarConsulta } from './ayudantes';
test('valida el acceso y permite a una cuenta autenticada de lectura consultar las cuatro pantallas sin escrituras', async ({
  page,
}, informacion) => {
  for (const ruta of ['/maquinarias', '/horometros', '/combustible', '/control-diario']) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/acceso$/);
    await expect(page.getByRole('button', { name: 'Continuar como invitado' })).toHaveCount(0);
  }
  await page.evaluate(() => sessionStorage.setItem('marimba.sesion.v1', 'invitado'));
  await page.reload();
  await expect(page).toHaveURL(/\/acceso$/);
  expect(await page.evaluate(() => sessionStorage.getItem('marimba.sesion.v1'))).toBeNull();
  await page.goto('/combustible');
  await expect(page).toHaveURL(/\/acceso$/);
  await page.screenshot({ path: informacion.outputPath('acceso.png'), fullPage: true });
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByText('Ingresa tu usuario.')).toBeVisible();
  await expect(page.getByText('Ingresa tu contraseña.')).toBeVisible();
  await page.getByLabel('Usuario', { exact: true }).fill('prueba.admin');
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrectos');
  await iniciarConsulta(page);
  await expect(page).toHaveURL(/\/combustible$/);
  for (const nombre of ['Maquinarias', 'Horómetros', 'Combustible', 'Control Diario']) {
    await navegar(page, informacion, nombre);
    await expect(page.getByRole('heading', { name: nombre, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Registrar / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar registro', exact: true })).toHaveCount(0);
    await page.getByLabel('Buscar registros').fill('NO-EXISTE');
    await expect(page.getByText('No hay registros para mostrar')).toBeVisible();
    await page.getByLabel('Buscar registros').fill('');
  }
  await expect(page.getByRole('button', { name: 'Consultar registro', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Ver historial', exact: true })).toHaveCount(0);
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .getByRole('columnheader', { name: 'Acciones', exact: true }),
  ).toHaveCount(0);
  await page.locator('#selector-usuario').click();
  await expect(page.getByRole('button', { name: 'Administrar usuarios' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
});
test('respeta permisos de capturista por módulo y restaura la sesión al recargar', async ({
  page,
}, informacion) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page, 'prueba.restringido');
  await expect(page.getByRole('button', { name: 'Registrar maquinaria' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar registro', exact: true })).toHaveCount(0);
  await navegar(page, informacion, 'Horómetros');
  await expect(page.getByRole('button', { name: 'Registrar horómetro' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Editar registro', exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('#selector-usuario')).toContainText('Carlos Ramírez');
  await navegar(page, informacion, 'Control Diario');
  await expect(page.getByRole('button', { name: 'Registrar operación' })).toHaveCount(0);
  await page.locator('#selector-usuario').click();
  await expect(page.getByRole('button', { name: 'Administrar usuarios' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.goto('/horometros');
  await expect(page).toHaveURL(/\/acceso$/);
});
// Pendiente de la futura ubicación administrativa; los servicios siguen cubiertos por pruebas unitarias.
test.skip('administra cuentas, valida duplicados, asigna permisos y revoca sesiones desactivadas', async ({
  page,
  context,
}, informacion) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await administrar(page);
  await expect(page.getByRole('button', { name: 'Desactivar a Ana Martínez' })).toBeDisabled();
  await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
  await page.getByLabel('Nombre completo *').fill('Elena de Prueba');
  await page.getByLabel('Nombre de usuario *').fill('prueba.admin');
  await page.getByLabel('Contraseña *', { exact: true }).fill('Cuenta2026!Demo');
  await page.getByLabel('Rol *').selectOption('CAPTURISTA');
  await page.getByLabel('Maquinarias', { exact: true }).check();
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar usuario', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ya está registrado');
  await page.getByLabel('Nombre de usuario *').fill('elena.prueba');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar usuario', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Usuario creado');
  await page.getByRole('button', { name: 'Editar a Elena de Prueba' }).click();
  await page.getByLabel('Nombre completo *').fill('Elena Prueba Actualizada');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar usuario', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('actualizado');
  const capturista = await context.newPage();
  await capturista.goto('/maquinarias');
  await iniciarSesion(capturista, 'elena.prueba', 'Cuenta2026!Demo');
  await expect(capturista.getByRole('button', { name: 'Registrar maquinaria' })).toBeVisible();
  await navegar(capturista, informacion, 'Combustible');
  await expect(capturista.getByRole('button', { name: 'Registrar suministro' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desactivar a Elena Prueba Actualizada' }).click();
  await page.getByRole('button', { name: 'Confirmar desactivación' }).click();
  await expect(page.getByRole('status')).toContainText('Estado de la cuenta actualizado');
  await expect(capturista).toHaveURL(/\/acceso$/);
  await capturista.getByLabel('Usuario', { exact: true }).fill('elena.prueba');
  await capturista.getByLabel('Contraseña', { exact: true }).fill('Cuenta2026!Demo');
  await capturista.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(capturista.getByRole('alert')).toContainText('inactiva');
  await page.getByRole('button', { name: 'Activar a Elena Prueba Actualizada' }).click();
  await page.getByRole('button', { name: 'Confirmar activación' }).click();
  await expect(page.getByRole('status')).toContainText('Estado de la cuenta actualizado');
  await iniciarSesion(capturista, 'elena.prueba', 'Cuenta2026!Demo');
  await expect(capturista.locator('#selector-usuario')).toContainText('Elena Prueba Actualizada');
  const datos = await page.evaluate(() => localStorage.getItem('marimba.usuarios.v1'));
  expect(datos).not.toContain('Cuenta2026!Demo');
  expect(datos).not.toContain(contrasenaPrueba);
  await page.getByRole('button', { name: 'Cerrar administración' }).click();
  await cerrarSesion(page);
  await capturista.close();
});
