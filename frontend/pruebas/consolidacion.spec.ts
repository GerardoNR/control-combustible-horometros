import { confirmarCambios } from './ayudantes';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { iniciarSesion, navegar, iniciarConsulta } from './ayudantes';
test('consulta la consolidación de fuentes, exporta filtros y actualiza tras editar/eliminar', async ({
  page,
  context,
}, informacion) => {
  await page.goto('/horometros');
  await iniciarSesion(page);
  const consulta = await context.newPage();
  await consulta.goto('/control-diario');
  await iniciarConsulta(consulta);
  await consulta.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  const filas = (pagina = page) =>
    pagina
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody tr');
  await expect(filas(consulta)).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar horómetro' }).click();
  await page.getByLabel('Maquinaria *').selectOption('maq-7');
  await expect(page.getByLabel('Lectura inicial (h) *')).toHaveValue('1240');
  await page.getByLabel('Confirmo lectura inicial supervisada').check();
  await page.getByLabel('Lectura final (h) *').fill('1248');
  await page.getByLabel('Operador *').fill('Operador fuente');
  const fecha = await page.getByLabel('Fecha *', { exact: true }).inputValue();
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByRole('status')).toContainText('Registro creado');
  await expect(filas(consulta)).toHaveCount(1);
  await expect(filas(consulta)).toContainText('8 h');
  await expect(filas(consulta)).toContainText('Pendiente');
  await expect(consulta.getByRole('button', { name: 'Eliminar registro' })).toHaveCount(0);
  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await expect(filas()).toHaveCount(1);
  await expect(
    page.getByRole('button', {
      name: /^(Registrar operación|Editar registro|Consultar registro|Eliminar registro|Ver historial)$/,
    }),
  ).toHaveCount(0);
  // Simula una actividad existente en la fuente que entregará la API, sin captura desde Control Diario.
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    base.horometros.find(
      (registro: { maquinariaId: string }) => registro.maquinariaId === 'maq-7',
    ).actividad = 'Frente consolidado';
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Control Diario', exact: true })).toBeVisible();
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await expect(filas()).toHaveCount(1);
  await expect(filas()).not.toContainText('Frente consolidado');
  await expect(page.getByRole('columnheader', { name: 'Actividad/Frente de trabajo' })).toHaveCount(
    0,
  );
  await expect(page.getByLabel('Filtrar por actividad o frente')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .getByRole('columnheader', { name: 'Maquinaria', exact: true }),
  ).toHaveCount(1);
  await navegar(page, informacion, 'Combustible');
  for (const litros of ['40', '60']) {
    await page.getByRole('button', { name: 'Registrar suministro' }).click();
    await page.getByLabel('Maquinaria *').selectOption('maq-7');
    await page.getByLabel('Litros solicitados *').fill('100');
    await page.getByLabel('Litros cargados *').fill(litros);
    await page.getByLabel('Operador *').fill('Otro operador');
    await confirmarCambios(page);
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await page.getByLabel('Filtrar por operador').fill('fuente');
  await page.getByLabel('Fecha desde', { exact: true }).fill(fecha);
  await page.getByLabel('Fecha hasta', { exact: true }).fill(fecha);
  await page.getByLabel('Buscar registros').fill('RET-007');
  await expect(filas()).toHaveCount(1);
  await expect(filas()).toContainText('100 L');
  await expect(filas()).toContainText('12.5 L/h');
  const descargaExcel = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
  const excel = await descargaExcel;
  expect(excel.suggestedFilename()).toMatch(/\.xlsx$/);
  const ruta = await excel.path();
  const libro = new ExcelJS.Workbook();
  const bytes = await readFile(ruta!);
  await libro.xlsx.load(new Uint8Array(bytes).buffer);
  const hoja = libro.getWorksheet('Control Diario')!;
  expect(hoja.getCell('I5').value).toBe(100);
  expect(hoja.getCell('J5').value).toBe(12.5);
  expect(hoja.getCell('H5').value).toBe(8);
  expect(hoja.getCell('C4').value).toBe('Maquinaria');
  expect(hoja.columnCount).toBe(11);
  expect(hoja.getCell('D5').value).toBe('Operador fuente / Otro operador');
  const descargaPdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const pdf = await descargaPdf;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect((await readFile((await pdf.path())!)).subarray(0, 4).toString()).toBe('%PDF');
  await page.getByLabel('Buscar registros').fill('Sin resultados');
  await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No hay resultados');
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await navegar(page, informacion, 'Combustible');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await expect(filas()).toHaveCount(2);
  await page.getByRole('button', { name: 'Editar registro', exact: true }).first().click();
  await page.getByLabel('Litros cargados *').fill('20');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(filas(consulta)).toContainText('60 L');
  await page.getByRole('button', { name: 'Eliminar registro', exact: true }).first().click();
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
  await expect(filas()).toHaveCount(1);
  await expect(filas(consulta)).toContainText('40 L');
  await page.getByRole('button', { name: 'Eliminar registro', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
  await expect(filas()).toHaveCount(0);
  await expect(filas(consulta)).toContainText('Pendiente');
  await expect(filas(consulta)).toContainText('Operador fuente');
  await navegar(page, informacion, 'Horómetros');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await expect(filas()).toHaveCount(1);
  await page.getByRole('button', { name: 'Eliminar registro', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
  await expect(filas(consulta)).toHaveCount(0);
  await expect(consulta.getByText('No hay registros para mostrar')).toBeVisible();
  const historial = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('marimba.datos.v1')!).horometros.find(
        (registro: { maquinariaId: string }) => registro.maquinariaId === 'maq-7',
      ).historial,
  );
  expect(historial.at(-1).accion).toBe('Eliminación');
  await consulta.close();
});
