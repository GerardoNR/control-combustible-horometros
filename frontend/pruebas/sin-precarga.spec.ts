import { test, expect } from '@playwright/test';
import { iniciarSesion, navegar } from './ayudantes';

test('no crea cuentas, sesiones ni operaciones en una instalación nueva', async ({ page }) => {
  await page.goto('/acceso');
  await expect(page.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
  expect(await page.evaluate(() => ({
    cuentas: localStorage.getItem('marimba.usuarios.v1'),
    operaciones: localStorage.getItem('marimba.datos.v1'),
    sesion: sessionStorage.getItem('marimba.sesion.v1'),
  }))).toEqual({ cuentas: null, operaciones: null, sesion: null });
  await page.reload();
  await expect(page.getByLabel('Usuario', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('marimba.usuarios.v1'))).toBeNull();
});

test('con una cuenta aislada las cuatro pantallas inician vacías y siguen vacías tras recargar', async ({ page }, informacion) => {
  await page.goto('/acceso');
  await iniciarSesion(page, undefined, undefined, true);
  for (const pantalla of ['Maquinarias', 'Horómetros', 'Combustible', 'Control Diario']) {
    await navegar(page, informacion, pantalla);
    await expect(page.getByText('No hay registros para mostrar')).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Control Diario', exact: true })).toBeVisible();
  const base = await page.evaluate(() => JSON.parse(localStorage.getItem('marimba.datos.v1')!));
  for (const coleccion of ['maquinarias', 'horometros', 'combustible', 'control-diario', 'catalogos', 'mantenimientos', 'asignacionesOperadores', 'importacionesCatalogos'])
    expect(base[coleccion]).toEqual([]);
});
