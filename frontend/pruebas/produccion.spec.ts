import { test, expect } from '@playwright/test';
import { crearMuestraFicticia } from './datos/operaciones-completas';
test.use({ baseURL: 'http://127.0.0.1:5175' });

test('el build conserva operaciones existentes y no crea cuentas ni permite credenciales locales', async ({ page }) => {
  const muestra = crearMuestraFicticia();
  await page.addInitScript((base) => {
    if (!localStorage.getItem('marimba.datos.v1'))
      localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  }, muestra);
  await page.goto('/acceso');
  await expect(page.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
  const operaciones = JSON.stringify(muestra);
  expect(await page.evaluate(() => ({
    operaciones: localStorage.getItem('marimba.datos.v1'),
    temporal: localStorage.getItem('marimba.usuarios.desarrollo.v1'),
    cuentas: localStorage.getItem('marimba.usuarios.v1'),
  }))).toEqual({ operaciones, temporal: null, cuentas: null });
  for (const [usuario, contrasena] of [['admin1', '123456781'], ['admin2', '123456782']]) {
    await page.getByLabel('Usuario', { exact: true }).fill(usuario);
    await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('incorrectos');
    await expect(page).toHaveURL(/\/acceso$/);
  }
});
