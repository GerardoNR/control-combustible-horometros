import { test, expect } from '@playwright/test';
import { confirmarCambios, iniciarSesion, navegar } from './ayudantes';
import type { BaseDatos } from '../src/compartido/tipos/datos';
import type { TestInfo } from '@playwright/test';

test('administra operador vigente desde Maquinarias sin alterar lecturas históricas', async ({
  page,
}, informacion) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await page.getByLabel('Buscar registros').fill('EXC-001');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Residente', exact: true }).click();
  await page.getByRole('button', { name: 'Asignar operador vigente', exact: true }).click();
  await page.getByLabel('Nuevo operador *').fill('Operador asignado uno');
  await page.getByLabel('Fecha de inicio *').fill('2020-01-01');
  await page.getByLabel('Motivo de la asignación o cambio *').fill('Primera asignación de prueba');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cambiar operador vigente' })).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar operador vigente', exact: true }).click();
  await page.getByLabel('Nuevo operador *').fill('Operador asignado dos');
  await page.getByLabel('Fecha de inicio *').fill('2020-01-02');
  await page.getByLabel('Motivo de la asignación o cambio *').fill('Relevo de prueba');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await page.getByLabel('Cerrar', { exact: true }).click();

  await navegar(page, informacion, 'Horómetros');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-1');
  await expect(page.getByRole('button', { name: 'Asignaciones de operadores' })).toHaveCount(0);
  const original = await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos;
    return base.horometros.find((lectura) => lectura.maquinariaId === 'maq-1')!;
  });
  await page.getByRole('button', { name: 'Editar registro', exact: true }).first().click();
  const campoOperador = page.getByLabel('Operador *', { exact: true });
  await campoOperador.fill('Operador corregido de lectura');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).first().click();
  const detalle = page.getByRole('dialog');
  await expect(detalle.getByRole('region', { name: 'Datos del horómetro' })).toContainText(
    'Operador corregido de lectura',
  );
  await detalle.locator('summary').filter({ hasText: 'Movimientos de operadores' }).click();
  await expect(detalle.getByRole('region', { name: 'Historial cronológico de operadores' })).toContainText(
    'Operador asignado uno',
  );
  await expect(detalle.getByRole('region', { name: 'Historial cronológico de operadores' })).toContainText(
    'Operador asignado dos',
  );
  await expect(detalle.getByRole('button', { name: /Cambiar operador|Registrar asignación/ })).toHaveCount(0);
  const guardado = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos,
  );
  expect(guardado.horometros.find((lectura) => lectura.id === original.id)?.operador).toBe(
    'Operador corregido de lectura',
  );
  expect(guardado.asignacionesOperadores?.map(({ operador }) => operador)).toContain(
    'Operador asignado uno',
  );
  expect(guardado.asignacionesOperadores?.map(({ operador }) => operador)).toContain(
    'Operador asignado dos',
  );
});

test('oculta la administración de asignaciones a usuarios sin permiso de Maquinarias', async ({
  page,
}, informacion: TestInfo) => {
  await page.goto('/horometros');
  await iniciarSesion(page, 'prueba.restringido');
  await expect(page.getByRole('button', { name: 'Asignaciones de operadores' })).toHaveCount(0);
  await navegar(page, informacion, 'Maquinarias');
  await expect(page.getByRole('button', { name: 'Editar registro', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar maquinaria' })).toHaveCount(0);
});
