import { confirmarCambios } from './ayudantes';
import { test, expect } from '@playwright/test';
import { iniciarSesion } from './ayudantes';
import type { BaseDatos } from '../src/compartido/tipos/datos';
test('registra y edita los nuevos datos sin inventar valores de suministros anteriores', async ({
  page,
}, informacion) => {
  await page.goto('/combustible');
  await iniciarSesion(page);
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos;
    const campos = [
      'nombreResidente',
      'pkResidente',
      'numeroOrquesta',
      'nombreDespachador',
    ] as const;
    const registro = base.combustible.find((suministro) => suministro.id === 'com-1')!;
    for (const campo of campos) {
      delete registro[campo];
      for (const cambio of registro.historial) {
        delete cambio.valores[campo];
        if (cambio.anteriores) delete cambio.anteriores[campo];
      }
    }
    Object.assign(registro, { ingeniero: 'Residente legado' });
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Combustible', exact: true })).toBeVisible();
  const tabla = page.getByRole('region', {
    name: 'Tabla de registros, desplazable horizontalmente',
  });
  await expect(tabla.getByRole('columnheader')).toHaveText([
    'Fecha',
    'N° económico',
    'Maquinaria',
    'Tipo de combustible',
    'Cantidad solicitada',
    'Cantidad cargada',
    'Operador',
    'Residente / PK',
    'N° de orquesta',
    'Nombre del despachador',
    'Acciones',
  ]);
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-1');
  await expect(tabla.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await expect(page.getByLabel('Nombre del residente', { exact: true })).toHaveValue(
    'Residente legado',
  );
  await expect(page.getByLabel('Ingeniero a cargo', { exact: false })).toHaveCount(0);
  for (const etiqueta of [
    'PK donde trabaja el residente',
    'Número de orquesta',
    'Nombre del despachador',
  ])
    await expect(page.getByLabel(etiqueta, { exact: true })).toHaveValue('');
  await page.getByLabel('Nombre del residente', { exact: true }).fill('Adriana Prueba');
  await page.keyboard.press('Tab');
  await page.getByLabel('PK donde trabaja el residente', { exact: true }).fill('PK 400+060');
  await page.getByLabel('Número de orquesta', { exact: true }).fill('0007');
  await page.getByLabel('Nombre del despachador', { exact: true }).fill('Luis Prueba');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Cambios guardados');
  const fila = tabla.locator('tbody tr').first();
  await expect(fila.locator('td').nth(4)).toHaveText('100 L');
  await expect(fila.locator('td').nth(5)).toHaveText('95 L');
  await expect(fila.locator('td').nth(7)).toContainText('Adriana Prueba');
  await expect(fila.locator('td').nth(7).locator('small')).toHaveText('PK 400+060');
  await expect(fila.locator('td').nth(8)).toHaveText('0007');
  await expect(fila.locator('td').nth(9)).toHaveText('Luis Prueba');
  await expect(
    fila.locator('td').last().getByRole('group', { name: 'Acciones del registro' }),
  ).toHaveCount(1);
  const tamanos = await fila
    .locator('td')
    .nth(7)
    .evaluate((celda) => ({
      principal: parseFloat(getComputedStyle(celda.querySelector('span')!).fontSize),
      pk: parseFloat(getComputedStyle(celda.querySelector('small')!).fontSize),
    }));
  expect(tamanos.pk).toBeLessThan(tamanos.principal);
  await fila.locator('td').nth(7).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: informacion.outputPath('combustible-residente.png'),
    fullPage: true,
  });
  await page.reload();
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-1');
  await expect(tabla.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await expect(page.getByLabel('Número de orquesta', { exact: true })).toHaveValue('0007');
  await page.getByLabel('PK donde trabaja el residente', { exact: true }).fill('PK 120+500');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(fila.locator('td').nth(7).locator('small')).toHaveText('PK 120+500');
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await page.screenshot({
    path: informacion.outputPath('consulta-combustible.png'),
    fullPage: true,
  });
  await expect(page.getByRole('dialog')).toContainText('Adriana Prueba');
  await expect(page.getByRole('dialog')).toContainText('PK 120+500');
  await page.getByText('Historial de modificaciones', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Nombre del residente');
  await expect(page.getByRole('dialog')).toContainText('PK 400+060');
  await expect(page.getByRole('dialog')).not.toContainText('undefined');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar suministro', exact: true }).click();
  await page.getByText('Datos complementarios del suministro', { exact: true }).click();
  await page.getByLabel('Maquinaria *').selectOption('maq-7');
  await page.getByLabel('Litros solicitados *').fill('70');
  await page.getByLabel('Litros cargados *').fill('65');
  await page.getByLabel('Operador *').fill('Operador de prueba');
  await page.getByLabel('Nombre del residente', { exact: true }).fill('Elena de prueba');
  await page.keyboard.press('Tab');
  await page.getByLabel('PK donde trabaja el residente', { exact: true }).fill('015+100');
  await page.getByLabel('Número de orquesta', { exact: true }).fill('ORQ-008');
  await page.getByLabel('Nombre del despachador', { exact: true }).fill('Arturo Prueba');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await expect(tabla.locator('tbody tr')).toHaveCount(1);
  await expect(fila.locator('td').nth(5)).toHaveText('65 L');
  await expect(fila.locator('td').nth(7)).toContainText('Elena de prueba');
  await expect(fila.locator('td').nth(7).locator('small')).toHaveText(/PK: 015\+100/);
  const ancho = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    pantalla: innerWidth,
  }));
  expect(ancho.documento).toBeLessThanOrEqual(ancho.pantalla);
});
