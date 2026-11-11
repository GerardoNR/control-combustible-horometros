import { test, expect } from '@playwright/test';
import { navegar } from './ayudantes';
import { crearMuestraFicticia } from './datos/operaciones-completas';
import { crearDemostracion } from './datos/operaciones-legadas';
test.use({ baseURL: 'http://127.0.0.1:5174' });

test('los dos administradores locales ingresan, consultan pantallas vacías y cierran sesión', async ({ page }, informacion) => {
  await page.goto('/acceso');
  await expect(page.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
  for (const [usuario, contrasena] of [['admin1', '123456781'], ['admin2', '123456782']]) {
    await expect(page.getByLabel('Usuario', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(contrasena);
    await page.getByLabel('Usuario', { exact: true }).fill(usuario);
    await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    for (const pantalla of ['Maquinarias', 'Horómetros', 'Combustible', 'Control Diario']) {
      await navegar(page, informacion, pantalla);
      await expect(page.getByText('No hay registros para mostrar')).toBeVisible();
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Control Diario', exact: true })).toBeVisible();
    await page.locator('#selector-usuario').click();
    await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
  }
  const estado = await page.evaluate(() => ({
    cuentas: JSON.parse(localStorage.getItem('marimba.usuarios.desarrollo.v1')!),
    antiguas: localStorage.getItem('marimba.usuarios.v1'),
    base: JSON.parse(localStorage.getItem('marimba.datos.v1')!),
    sesion: sessionStorage.getItem('marimba.sesion.v1'),
  }));
  expect(estado.cuentas.map((cuenta: { nombreUsuario: string }) => cuenta.nombreUsuario)).toEqual(['admin1', 'admin2']);
  expect(estado.antiguas).toBeNull();
  expect(estado.sesion).toBeNull();
  expect(Object.values(estado.base).every((registros) => Array.isArray(registros) && registros.length === 0)).toBe(true);
});

test('conserva las operaciones locales al preparar cuentas de desarrollo', async ({ page }) => {
  const muestra = crearMuestraFicticia();
  await page.addInitScript((base) => {
    if (!localStorage.getItem('marimba.datos.v1')) {
      localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
      localStorage.setItem('preferencias', 'conservar');
    }
  }, muestra);
  await page.goto('/acceso');
  await expect(page.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
  const cuentas = await page.evaluate(() => localStorage.getItem('marimba.usuarios.desarrollo.v1'));
  const operaciones = JSON.stringify(muestra);
  expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(operaciones);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
  expect(await page.evaluate(() => ({
    operaciones: localStorage.getItem('marimba.datos.v1'),
    preferencias: localStorage.getItem('preferencias'),
    cuentas: localStorage.getItem('marimba.usuarios.desarrollo.v1'),
    migracion: localStorage.getItem('marimba.migraciones.limpieza-operativa.v1'),
  }))).toEqual({ operaciones, preferencias: 'conservar', cuentas, migracion: null });
});

test('las claves desconocidas se conservan y no bloquean el inicio de sesión', async ({ page }, informacion) => {
  const legado = crearDemostracion();
  await page.addInitScript((base) => {
    if (!localStorage.getItem('marimba.datos.v1'))
      localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
    localStorage.setItem('marimba.clave-desconocida.v1', 'conservar');
  }, legado);
  await page.goto('/acceso');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('marimba.datos.v1')!))).toEqual(legado);
  expect(await page.evaluate(() => localStorage.getItem('marimba.migraciones.limpieza-operativa.v1'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('marimba.clave-desconocida.v1'))).toBe('conservar');
  await page.getByLabel('Usuario', { exact: true }).fill('admin1');
  await page.getByLabel('Contraseña', { exact: true }).fill('123456781');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.locator('#selector-usuario')).toBeVisible();
  await navegar(page, informacion, 'Maquinarias');
  await expect(page.locator('tbody')).toContainText('EXC-001');
  expect(await page.evaluate(() => localStorage.getItem('marimba.clave-desconocida.v1'))).toBe('conservar');
});
