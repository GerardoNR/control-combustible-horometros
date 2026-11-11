import { test, expect } from '@playwright/test';
import { iniciarSesionConMuestraCompleta } from './ayudantes';
import type { BaseDatos } from '../src/compartido/tipos/datos';
import { fechaCorta, numero } from '../src/compartido/utilidades/formato';

test.use({ timezoneId: 'America/Monterrey' });
test('agrega, consulta y edita sin campos retirados y conserva los datos históricos', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'));
  await page.goto('/horometros');
  await iniciarSesionConMuestraCompleta(page);
  const anterior = await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos;
    const registro = base.horometros.find(
      (r) => r.maquinariaId === 'prueba-maq-01' && r.fecha === '2026-11-09',
    )!;
    Object.assign(registro, {
      actividad: 'Frente histórico reservado',
      frenteId: 'prueba-frentes-01',
      horaAsignacion: '07:35',
    });
    Object.assign(registro.historial[0].valores, {
      actividad: registro.actividad,
      frenteId: registro.frenteId,
      horaAsignacion: registro.horaAsignacion,
    });
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
    return { registro, movimientos: base.asignacionesOperadores };
  });
  await page.reload();
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  const modal = page.getByRole('dialog');
  async function comprobarCamposRetirados() {
    await expect(modal).not.toContainText(
      /Actividad|Frente histórico reservado|Hora de asignación|Hora no registrada|07:35/,
    );
    await expect(modal.locator('input[type="time"]')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).first().click();
  await modal.getByText('Historial de modificaciones', { exact: true }).click();
  await modal.getByText('Movimientos de operadores', { exact: true }).first().click();
  await comprobarCamposRetirados();
  await expect(modal).toContainText(fechaCorta(anterior.registro.fechaAsignacion));
  await expect(
    modal.getByRole('button', { name: /Guardar|Editar|Eliminar|Cambiar operador/ }),
  ).toHaveCount(0);
  await expect(
    modal.getByRole('region', { name: 'Historial cronológico de operadores' }).locator('tbody tr'),
  ).toHaveCount(2);
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar registro', exact: true }).first().click();
  await comprobarCamposRetirados();
  await expect(modal.getByLabel('Fecha de asignación del operador')).toHaveValue(
    anterior.registro.fechaAsignacion,
  );
  await expect(modal.getByLabel('Operador *', { exact: true })).toHaveValue(
    anterior.registro.operador,
  );
  await modal.getByLabel('Lectura final (h) *').fill('2422');
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar horómetro', exact: true }).click();
  await modal.getByLabel('Maquinaria *').selectOption('prueba-maq-01');
  await comprobarCamposRetirados();
  await expect(modal.getByLabel('Lectura inicial (h) *')).toHaveValue('2422');
  await expect(modal.getByLabel('Fecha de asignación del operador')).toHaveValue(
    anterior.registro.fechaAsignacion,
  );
  await modal.getByLabel('Lectura final (h) *').fill('2425');
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal).toHaveCount(0);
  const posterior = (await page.evaluate(() =>
    JSON.parse(localStorage.getItem('marimba.datos.v1')!),
  )) as BaseDatos;
  const editado = posterior.horometros.find((r) => r.id === anterior.registro.id)!;
  expect(editado).toMatchObject({
    actividad: anterior.registro.actividad,
    frenteId: anterior.registro.frenteId,
    horaAsignacion: anterior.registro.horaAsignacion,
    fechaAsignacion: anterior.registro.fechaAsignacion,
    operador: anterior.registro.operador,
    lecturaFinal: 2422,
  });
  expect(editado.historial.slice(0, anterior.registro.historial.length)).toEqual(
    anterior.registro.historial,
  );
  expect(posterior.asignacionesOperadores).toEqual(anterior.movimientos);
  const nuevo = posterior.horometros.find((r) => r.lecturaInicial === 2422)!;
  for (const campo of ['actividad', 'frenteId', 'horaAsignacion'])
    expect(nuevo).not.toHaveProperty(campo);
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).first().click();
  await comprobarCamposRetirados();
  await expect(modal).toContainText(numero(2422, 2));
  expect(await modal.locator('input, select, textarea').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(modal).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: informacion.outputPath('horometro-simplificado.png'),
    animations: 'disabled',
    fullPage: true,
  });
});
