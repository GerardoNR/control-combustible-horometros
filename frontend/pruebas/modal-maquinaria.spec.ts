import { confirmarCambios } from './ayudantes';
import { test, expect } from '@playwright/test';
import { iniciarSesion } from './ayudantes';
test('organiza la consulta y conserva periodos de residentes con nombres y PK históricos', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-07T15:00:00Z'));
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await page.getByLabel('Buscar registros').fill('RET-007');
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  const dialogo = page.getByRole('dialog');
  for (const titulo of ['Información general', 'Estado del equipo'])
    await expect(dialogo.getByRole('heading', { name: titulo, exact: true })).toBeVisible();
  expect(
    await dialogo
      .getByRole('heading', { name: 'Información general', exact: true })
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await dialogo.getByRole('tab', { name: 'Responsables', exact: true }).click();
  await expect(
    dialogo.getByRole('heading', { name: 'Responsables actuales', exact: true }),
  ).toBeVisible();
  await dialogo.getByRole('tab', { name: 'Historial', exact: true }).click();
  await dialogo.getByText('Operadores', { exact: true }).click();
  await expect(
    dialogo
      .locator('[data-apartado-historial]')
      .nth(0)
      .getByText('Sin movimientos registrados', { exact: true }),
  ).toBeVisible();
  await dialogo.getByText('Residentes y ubicaciones', { exact: true }).click();
  await expect(
    dialogo
      .locator('[data-apartado-historial]')
      .nth(1)
      .getByText('Sin movimientos registrados', { exact: true }),
  ).toBeVisible();
  await expect(
    dialogo.getByRole('button', { name: /Registrar|Guardar|Editar|Eliminar/ }),
  ).toHaveCount(0);
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
  async function cambiarResidente(indice: number, motivo: string) {
    await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
    await dialogo.getByRole('tab', { name: 'Residente', exact: true }).click();
    const selector = dialogo.getByLabel('Ingeniero residente', { exact: true });
    const nombre = await page.evaluate(
      (indice) =>
        JSON.parse(localStorage.getItem('marimba.datos.v1')!).combustible[indice - 1]
          .nombreResidente,
      indice,
    );
    await selector.fill(nombre);
    await dialogo
      .getByLabel('Fecha de asignación *')
      .fill(indice === 1 ? '2026-11-07' : '2026-11-08');
    await dialogo.getByLabel('Motivo del cambio', { exact: false }).fill(motivo);
    await confirmarCambios(page);
    await dialogo.getByRole('button', { name: 'Guardar residente y ubicación' }).click();
    await expect(selector).toHaveValue(nombre);
    await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
  }
  await cambiarResidente(1, 'Inicio de responsabilidad');
  await page.clock.setFixedTime(new Date('2026-11-08T15:00:00Z'));
  await cambiarResidente(2, 'Relevo del frente');
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await dialogo.getByRole('tab', { name: 'Historial', exact: true }).click();
  await dialogo.getByText('Residentes y ubicaciones', { exact: true }).click();
  const residentes = dialogo.getByRole('region', { name: 'Historial cronológico de residentes' });
  await expect(residentes.locator('li')).toHaveCount(2);
  await expect(residentes).toContainText('Adriana Salazar');
  await expect(residentes).toContainText('Verónica Castillo');
  await expect(residentes).toContainText('014+800');
  await expect(residentes.locator('li').first()).toContainText('Vigente');
  await expect(residentes.locator('li').last()).toContainText('Finalizado');
  await dialogo.getByLabel('Consultar historial por fecha').fill('2026-11-07');
  await expect(dialogo.getByRole('status')).toContainText('Adriana Salazar');
  await dialogo.getByRole('button', { name: 'Hoy', exact: true }).click();
  await expect(dialogo.getByRole('status')).toContainText('Verónica Castillo');
  await dialogo.getByText('Modificaciones', { exact: true }).click();
  const cambios = dialogo.getByRole('region', {
    name: 'Historial de modificaciones de maquinaria',
  });
  await expect(cambios).toContainText('Cambio de residente');
  await expect(cambios).toContainText('Ana Martínez');
  await expect(cambios).toContainText('Anterior: Adriana Salazar');
  await expect(cambios).toContainText('Nuevo: Verónica Castillo');
  await expect(cambios).not.toContainText('residenteId');
  await expect(cambios).not.toContainText('periodosResidentes');
  await page.screenshot({ path: informacion.outputPath('modal-historial.png'), fullPage: true });
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  await page.getByLabel('Buscar registros').fill('RET-007');
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await dialogo.getByRole('tab', { name: 'Historial', exact: true }).click();
  await dialogo.getByText('Residentes y ubicaciones', { exact: true }).click();
  await expect(residentes.locator('li')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
