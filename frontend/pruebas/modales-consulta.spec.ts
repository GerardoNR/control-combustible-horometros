import { test, expect } from '@playwright/test';
import { iniciarSesion } from './ayudantes';
for (const modulo of ['maquinarias', 'horometros', 'combustible']) {
  test(`consulta ${modulo} con encabezado fijo, desplazamiento interno y cierre accesible`, async ({
    page,
  }, informacion) => {
    await page.goto(`/${modulo}`);
    await iniciarSesion(page);
    await page.evaluate((modulo) => {
      const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
      const registro = base[modulo][0];
      const original = registro.historial[0];
      registro.historial = Array.from({ length: 40 }, (_, indice) => ({
        ...original,
        fecha: new Date(Date.parse(original.fecha) + indice * 1000).toISOString(),
        accion: 'Edición',
        anteriores: { observaciones: 'Valor anterior' },
        valores: { observaciones: `Evento inferior ${indice}` },
      }));
      localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
    }, modulo);
    await page.reload();
    await page.getByLabel('Buscar registros').fill('EXC-001');
    const abrir = page.getByRole('button', { name: 'Consultar registro', exact: true }).first();
    await expect(abrir).toBeVisible();
    const datosAntes = await page.evaluate(() => localStorage.getItem('marimba.datos.v1'));
    await abrir.click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.locator('.modal-dialog')).toHaveCSS('transform', 'none');
    const contenido = dialogo.locator('.modal-content');
    const encabezado = dialogo.locator('.modal-header');
    await expect(encabezado).toContainText('EXC-001');
    await expect(encabezado).toContainText('Excavadora');
    await expect(encabezado).toContainText('Operativa');
    const limites = await contenido.boundingBox();
    const pantalla = page.viewportSize()!;
    expect(limites!.height).toBeLessThanOrEqual(pantalla.height * 0.9 + 2);
    expect(limites!.width).toBeGreaterThan(
      pantalla.width * (informacion.project.name === 'escritorio' ? 0.8 : 0.85),
    );
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    const fondo = await page.evaluate(() => scrollY);
    const posicionCabecera = (await encabezado.boundingBox())!.y;
    if (modulo === 'maquinarias') {
      const general = dialogo.getByRole('tab', { name: 'General', exact: true });
      await general.focus();
      await page.keyboard.press('ArrowRight');
      await expect(dialogo.getByRole('tab', { name: 'Responsables', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.keyboard.press('ArrowRight');
      await expect(dialogo.getByRole('tab', { name: 'Historial', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
    await dialogo
      .getByText(modulo === 'maquinarias' ? 'Modificaciones' : 'Historial de modificaciones', {
        exact: true,
      })
      .click();
    const zona =
      modulo === 'maquinarias'
        ? dialogo.getByRole('tabpanel', { name: 'Historial', exact: true })
        : dialogo.locator('.modal-body');
    if (modulo === 'maquinarias')
      await expect(
        dialogo.locator('[data-apartado-historial]').last().locator(':scope > div'),
      ).toHaveClass(/\bshow\b/);
    await expect
      .poll(() => zona.evaluate((e) => e.scrollHeight - e.clientHeight))
      .toBeGreaterThan(0);
    await zona.focus();
    await page.keyboard.press('PageDown');
    await expect.poll(() => zona.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    const ultimo = dialogo.getByText(/Evento inferior 0/).last();
    await ultimo.scrollIntoViewIfNeeded();
    const posicion = await ultimo.boundingBox();
    const area = await zona.boundingBox();
    expect(posicion!.y).toBeGreaterThanOrEqual(area!.y - 1);
    expect(posicion!.y + posicion!.height).toBeLessThanOrEqual(area!.y + area!.height + 1);
    expect((await encabezado.boundingBox())!.y).toBeCloseTo(posicionCabecera, 0);
    expect(await page.evaluate(() => scrollY)).toBe(fondo);
    if (modulo === 'maquinarias') {
      const desplazamiento = await zona.evaluate((e) => e.scrollTop);
      await dialogo.getByRole('tab', { name: 'General', exact: true }).click();
      expect(
        await dialogo
          .getByRole('tabpanel', { name: 'General', exact: true })
          .evaluate((e) => e.scrollTop),
      ).toBe(0);
      await dialogo.getByRole('tab', { name: 'Historial', exact: true }).click();
      expect(await zona.evaluate((e) => e.scrollTop)).toBeCloseTo(desplazamiento, 0);
    }
    await page.screenshot({ path: informacion.outputPath(`consulta-${modulo}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(abrir).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(datosAntes);
  });
}
