import { confirmarCambios } from './ayudantes';
import { test, expect } from '@playwright/test';
import { iniciarSesion, navegar } from './ayudantes';

test('autocompleta asignación, supervisa primera lectura y consolida varias cargas sin cambiar el pasado', async ({
  page,
}, informacion) => {
  test.setTimeout(60000);
  await page.goto('/horometros');
  await iniciarSesion(page);
  await navegar(page, informacion, 'Maquinarias');
  await page.getByLabel('Buscar registros').fill('RET-007');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Residente', exact: true }).click();
  await page.getByRole('button', { name: 'Asignar operador vigente', exact: true }).click();
  await page.getByLabel('Nuevo operador *').fill('José Luis García');
  await page.getByLabel('Fecha de inicio *').fill('2020-01-01');
  await page.getByLabel('Motivo de la asignación o cambio *').fill('Asignación inicial comprobada');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cambiar operador vigente' })).toBeVisible();
  await page.getByLabel('Cerrar', { exact: true }).click();
  await navegar(page, informacion, 'Horómetros');
  await page.getByRole('button', { name: 'Registrar horómetro' }).click();
  await page.getByLabel('Maquinaria *').selectOption('maq-7');
  await expect(page.getByRole('button', { name: 'Asignaciones de operadores' })).toHaveCount(0);
  await expect(page.getByLabel('Lectura inicial (h) *')).toHaveValue('1240');
  await expect(page.getByLabel('Operador *', { exact: true })).toHaveValue('José Luis García');
  await expect(page.getByLabel('Operador *', { exact: true })).toBeEditable();
  await page.getByLabel('Lectura final (h) *').fill('1248');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(
    page.getByText('Un administrador debe confirmar la lectura inicial sin historial.'),
  ).toBeVisible();
  await page.getByLabel('Confirmo lectura inicial supervisada').check();
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByRole('status')).toContainText('Registro creado');
  await page.getByRole('button', { name: 'Registrar horómetro' }).click();
  await page.getByLabel('Maquinaria *').selectOption('maq-7');
  await expect(page.getByLabel('Lectura inicial (h) *')).toHaveValue('1248');
  await expect(page.getByLabel('Lectura inicial (h) *')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await navegar(page, informacion, 'Combustible');
  for (const cantidad of ['40', '60']) {
    await page.getByRole('button', { name: 'Registrar suministro' }).click();
    await page.getByLabel('Maquinaria *').selectOption('maq-7');
    await page.getByLabel('Hora de carga *').fill('12:00');
    await expect(page.getByLabel('Operador *', { exact: true })).toHaveValue('José Luis García');
    await page.getByLabel('Litros solicitados *').fill(cantidad);
    await page.getByLabel('Litros cargados *').fill(cantidad);
    await page.getByLabel('Nombre del residente', { exact: true }).fill('Adriana Salazar');
  await page.keyboard.press('Tab');
    await expect(page.getByLabel('PK donde trabaja el residente', { exact: true })).not.toHaveValue(
      '',
    );
    await confirmarCambios(page);
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await expect(page.getByRole('status')).toContainText('Registro creado');
  }
  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  const tabla = page.getByRole('region', {
    name: 'Tabla de registros, desplazable horizontalmente',
  });
  await expect(tabla.locator('tbody tr')).toHaveCount(1);
  await expect(tabla.locator('tbody')).toContainText('100 L');
  await expect(tabla.locator('tbody')).toContainText('12.5 L/h');
  const registros = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('marimba.datos.v1')!).horometros as {
        maquinariaId: string;
        operador: string;
        operadorId?: string;
      }[],
  );
  expect(registros.find((registro) => registro.maquinariaId === 'maq-7')).toMatchObject({
    operador: 'José Luis García',
    operadorId: expect.any(String),
  });
});
