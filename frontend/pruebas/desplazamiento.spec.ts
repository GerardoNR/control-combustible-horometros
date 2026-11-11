import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { iniciarSesion, iniciarSesionConMuestraCompleta, navegar } from './ayudantes';

const pantallas = ['Maquinarias', 'Horómetros', 'Combustible', 'Control Diario'];
const tabla = (pagina: Page) => pagina.getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' });

async function comprobarPagina(pagina: Page) {
  const medidas = await pagina.evaluate(() => ({
    desbordamiento: document.documentElement.scrollWidth - innerWidth,
    documento: document.scrollingElement === document.documentElement,
    desplazamiento: getComputedStyle(document.body).overflowY,
    principal: getComputedStyle(document.querySelector('main')!).overflowY,
  }));
  expect(medidas.desbordamiento).toBeLessThanOrEqual(1);
  expect(medidas.documento).toBe(true);
  expect(medidas.desplazamiento).toBe('scroll');
  expect(medidas.principal).toBe('visible');
}

async function comprobarMovimiento(pagina: Page) {
  await pagina.evaluate(() => window.scrollTo(0, 0));
  await pagina.getByRole('heading', { level: 1 }).hover();
  await pagina.mouse.wheel(0, 10000);
  await expect.poll(() => pagina.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect.poll(async () => (await pagina.locator('header').boundingBox())!.y).toBeCloseTo(0, 0);
  expect(await pagina.evaluate(() => document.body.scrollTop)).toBe(0);
  await pagina.locator('footer').scrollIntoViewIfNeeded();
  const pie = (await pagina.locator('footer').boundingBox())!;
  expect(pie.y + pie.height).toBeLessThanOrEqual(pagina.viewportSize()!.height + 1);
}

test('mantiene el carril nativo y el marco sin desbordamiento con las cuatro tablas vacías', async ({ page }, informacion) => {
  if (informacion.project.name === 'escritorio')
    await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/maquinarias');
  await iniciarSesion(page, undefined, undefined, true);
  for (const pantalla of pantallas) {
    await navegar(page, informacion, pantalla);
    await expect(page.getByText('No hay registros para mostrar')).toBeVisible();
    await comprobarPagina(page);
    if (pantalla === 'Maquinarias' && informacion.project.name === 'escritorio')
      expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)).toBeLessThanOrEqual(1);
    expect(await tabla(page).evaluate((elemento) => elemento.scrollTop)).toBe(0);
    await page.screenshot({ path: informacion.outputPath(`vacia-${pantalla}.png`), fullPage: true });
  }
});

test('permite recorrer páginas y tablas largas y recupera el scroll tras cerrar modales', async ({ page }, informacion) => {
  await page.goto('/maquinarias');
  await iniciarSesionConMuestraCompleta(page);
  const datosIniciales = await page.evaluate(() => localStorage.getItem('marimba.datos.v1'));
  for (const pantalla of pantallas) {
    await navegar(page, informacion, pantalla);
    if (pantalla === 'Horómetros' || pantalla === 'Combustible') {
      await page.getByLabel('Desde', { exact: true }).fill('');
      await page.getByLabel('Hasta', { exact: true }).fill('');
    } else if (pantalla === 'Control Diario') {
      await page.getByLabel('Fecha desde', { exact: true }).fill('');
      await page.getByLabel('Fecha hasta', { exact: true }).fill('');
    }
    await page.getByLabel('Registros por página').selectOption('32');
    await expect.poll(() => tabla(page).locator('tbody tr').count()).toBeGreaterThan(8);
    await comprobarPagina(page);
    await comprobarMovimiento(page);
    if (informacion.project.name === 'escritorio') {
      const lateral = (await page.locator('aside').boundingBox())!;
      expect(lateral.y).toBe(0);
      expect(lateral.height).toBe(page.viewportSize()!.height);
    }
    await expect.poll(() => tabla(page).evaluate((elemento) => elemento.scrollHeight - elemento.clientHeight)).toBeGreaterThan(0);
    await tabla(page).evaluate((elemento) => { elemento.scrollTop = elemento.scrollHeight; });
    await expect.poll(() => tabla(page).evaluate((elemento) => elemento.scrollTop)).toBeGreaterThan(0);
    await tabla(page).locator('tbody tr').last().scrollIntoViewIfNeeded();
    await expect(tabla(page).locator('tbody tr').last()).toBeInViewport();
    await page.screenshot({ path: informacion.outputPath(`larga-${pantalla}.png`), fullPage: true });

    if (pantalla !== 'Control Diario') {
      const abrir = tabla(page).getByRole('button', { name: 'Consultar registro', exact: true }).last();
      await abrir.click();
      const dialogo = page.getByRole('dialog');
      await expect(dialogo).toBeVisible();
      await expect(page.locator('body')).toHaveCSS('overflow-y', 'hidden');
      const fondo = await page.evaluate(() => window.scrollY);
      await page.mouse.move(5, page.viewportSize()!.height / 2);
      await page.mouse.wheel(0, -10000);
      await page.evaluate(() => new Promise<void>((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver()))));
      expect(await page.evaluate(() => window.scrollY)).toBe(fondo);
      await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await expect(dialogo).toBeHidden();
      await expect(page.locator('body')).toHaveCSS('overflow-y', 'scroll');
      await comprobarMovimiento(page);
      await comprobarPagina(page);
    }
  }
  expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(datosIniciales);
});
