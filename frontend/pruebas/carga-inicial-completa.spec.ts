import { contrasenaPrueba } from './datos/usuarios';
import { test, expect } from '@playwright/test';
import { iniciarSesion } from './ayudantes';

test('inicia sin registros ficticios y conserva el estado vacío tras recargar', async ({ page }) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page, 'prueba.admin', contrasenaPrueba, true);

  const inicial = await page.evaluate(() => JSON.parse(localStorage.getItem('marimba.datos.v1')!));
  expect([inicial.maquinarias.length, inicial.horometros.length, inicial.combustible.length]).toEqual([
    0,
    0,
    0,
  ]);
  expect(inicial['control-diario']).toEqual([]);
  expect(inicial.catalogos).toEqual([]);
  await expect(page.getByRole('button', { name: 'Registrar maquinaria' })).toBeVisible();

  await page.locator('#selector-usuario').click();
  await expect(page.getByRole('button', { name: /datos de ejemplo|muestra local/i })).toHaveCount(0);
  await page.reload();

  const recargada = await page.evaluate(() => JSON.parse(localStorage.getItem('marimba.datos.v1')!));
  expect([recargada.maquinarias.length, recargada.horometros.length, recargada.combustible.length]).toEqual([
    0,
    0,
    0,
  ]);
  expect(recargada['control-diario']).toEqual([]);
});
