import { test, expect } from '@playwright/test';
import { iniciarSesion, iniciarConsulta } from './ayudantes';

for (const usuario of ['prueba.admin', 'prueba.captura', 'invitado']) {
  test(`Historial solo permite consultar sin alterar datos: ${usuario}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-07T15:00:00Z'));
    await page.goto('/maquinarias');
    if (usuario === 'invitado') await iniciarConsulta(page);
    else await iniciarSesion(page, usuario);
    await page.evaluate(() => {
      const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
      const maquinaria = base.maquinarias.find(
        (m: { numeroEconomico: string }) => m.numeroEconomico === 'RET-007',
      );
      maquinaria.historial = [];
      maquinaria.periodosResidentes = [];
      maquinaria.fechaUltimoMantenimiento = '';
      maquinaria.observacionesMantenimiento = '';
      base.mantenimientos = [];
      base.asignacionesOperadores = [];
      localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
    });
    await page.reload();
    const antes = await page.evaluate(() => localStorage.getItem('marimba.datos.v1'));
    await page.getByLabel('Buscar registros').fill('RET-007');
    await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByRole('tab', { name: 'Historial', exact: true }).click();
    const historial = dialogo.getByRole('tabpanel', { name: 'Historial', exact: true });
    const calendario = historial.getByLabel('Consultar historial por fecha');
    await expect(calendario).toHaveAttribute('type', 'date');
    await expect(calendario).toHaveValue('2026-11-07');
    await calendario.fill('2020-01-01');
    await expect(historial.getByRole('status')).toContainText('Sin asignación registrada');
    await historial.getByRole('button', { name: 'Hoy', exact: true }).click();
    for (const titulo of [
      'Operadores',
      'Residentes y ubicaciones',
      'Mantenimientos',
      'Modificaciones',
    ]) {
      const apartado = historial
        .locator('[data-apartado-historial]')
        .filter({ has: page.getByText(titulo, { exact: true }) });
      await apartado.getByRole('button').click();
      await expect(
        apartado.getByText('Sin movimientos registrados', { exact: true }),
      ).toBeVisible();
      await expect(apartado.locator('.badge')).toHaveText('0');
    }
    await expect(historial.locator('input')).toHaveCount(1);
    await expect(historial.locator('form, select, textarea, button[type="submit"]')).toHaveCount(0);
    await expect(historial.getByRole('button')).toHaveCount(5);
    await expect(
      historial.getByRole('button', {
        name: /Registrar|Guardar|Editar|Eliminar|Cambiar|Asignaciones/,
      }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(antes);
  });
}
