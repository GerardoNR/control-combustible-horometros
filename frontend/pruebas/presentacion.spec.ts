import { test, expect } from '@playwright/test';
import { iniciarSesion, navegar } from './ayudantes';

test('presenta las cuatro pantallas sin desbordar el viewport y con contenedores definidos', async ({
  page,
}, informacion) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  for (const [indice, nombre] of [
    'Maquinarias',
    'Horómetros',
    'Combustible',
    'Control Diario',
  ].entries()) {
    if (indice) await navegar(page, informacion, nombre);
    const indicadores = page.locator('main article');
    await expect(page.locator('main table tbody strong').first()).toHaveCSS('font-weight', '400');
    await expect(page.locator('main table tbody td').first()).not.toContainText('●');

    await expect(indicadores).toHaveCount(nombre === 'Combustible' ? 3 : 4);
    await expect(page.getByRole('button', { name: 'Recargar datos', exact: true })).toHaveCount(0);
    const bordes = await indicadores.first().evaluate((elemento) => {
      const estilo = getComputedStyle(elemento);
      return { ancho: estilo.borderTopWidth, sombra: estilo.boxShadow };
    });
    expect(bordes.ancho).toBe('3px');
    expect(bordes.sombra).not.toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: informacion.outputPath(`pantalla-${indice}.png`),
      fullPage: true,
    });
  }
});

test('presenta las cuatro pantallas en laptop con menú plegable y foco visible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await page.getByRole('button', { name: 'Plegar menú', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expandir menú', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  for (const nombre of ['Maquinarias', 'Horómetros', 'Combustible', 'Control Diario']) {
    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .filter({ visible: true })
      .getByRole('link', { name: nombre, exact: true })
      .click();
    await expect(page.getByRole('heading', { name: nombre, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const tabla = page.getByRole('region', {
      name: 'Tabla de registros, desplazable horizontalmente',
    });
    await page.keyboard.press('Tab');
    await tabla.focus();
    await expect(tabla).toBeFocused();
    expect(await tabla.evaluate((elemento) => getComputedStyle(elemento).outlineStyle)).not.toBe(
      'none',
    );
  }
});
