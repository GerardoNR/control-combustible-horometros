import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
const { Workbook } = ExcelJS;
import { iniciarSesion, cerrarSesion } from './ayudantes';
async function archivo(duplicado = false) {
  const libro = new Workbook();
  const operadores = libro.addWorksheet('Operadores');
  operadores.addRow(['codigo', 'nombre']);
  operadores.addRow(['OP-100', 'Operador importado']);
  if (duplicado) operadores.addRow(['op-100', 'Duplicado']);
  const residentes = libro.addWorksheet('Residentes');
  residentes.addRow(['codigo', 'nombre', 'pk']);
  residentes.addRow(['RES-100', 'Residente importado', '100+200']);
  const maquinas = libro.addWorksheet('Maquinarias');
  maquinas.addRow(['numeroEconomico', 'placas', 'tipo', 'marca', 'modelo']);
  maquinas.addRow(['EXC-100', 'NL-100', 'Excavadora', 'CAT', '320']);
  return Buffer.from(await libro.xlsx.writeBuffer());
}
// Pendiente de la futura ubicación administrativa; se conserva el escenario para su reactivación.
test.skip('importa con vista previa, rechaza duplicados, confirma y conserva catálogos al editar', async ({
  page,
}, informacion) => {
  test.setTimeout(60000);
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await page.locator('#selector-usuario').click();
  await page.getByRole('button', { name: 'Catálogos y carga inicial', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Catálogos y carga inicial', exact: true });
  await modal.getByRole('tab', { name: 'Importar Excel', exact: true }).click();
  const antes = await page.evaluate(() => localStorage.getItem('marimba.datos.v1'));
  await modal.getByLabel('Archivo de carga inicial (.xlsx)').setInputFiles({
    name: 'duplicados.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await archivo(true),
  });
  await expect(modal.getByRole('region', { name: 'Vista previa de importación' })).toContainText(
    'Identificador duplicado',
  );
  await expect(modal.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(antes);
  const buffer = await archivo();
  await modal.getByLabel('Archivo de carga inicial (.xlsx)').setInputFiles({
    name: 'catalogos.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(modal.getByText('Vista previa · 3 registros · 0 existentes')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled();
  await page.screenshot({
    path: informacion.outputPath('vista-previa-catalogos.png'),
    fullPage: true,
  });
  await modal.getByLabel('Revisé la vista previa y confirmo guardar 3 registros').check();
  await modal.getByRole('button', { name: 'Confirmar importación' }).click();
  await expect(modal.getByRole('status')).toContainText('Carga inicial guardada: 3 registros');
  await modal.getByLabel('Archivo de carga inicial (.xlsx)').setInputFiles({
    name: 'catalogos.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(modal.getByRole('alert')).toContainText('ya fue importado');
  await modal.getByRole('tab', { name: 'Catálogos', exact: true }).click();
  await modal.getByLabel('Buscar en catálogos').fill('OP-100');
  await modal.getByRole('button', { name: 'Editar OP-100', exact: true }).click();
  await modal.getByLabel('Nombre *', { exact: true }).fill('Operador actualizado');
  await modal.getByRole('button', { name: 'Confirmar cambios de catálogo' }).click();
  await expect(modal.getByRole('region', { name: 'Registros de catálogos' })).toContainText(
    'Operador actualizado',
  );
  await modal.getByRole('button', { name: 'Cerrar catálogos', exact: true }).click();
  await page.getByLabel('Buscar registros').fill('EXC-100');
  await expect(page.locator('tbody')).toContainText('EXC-100');
  await page.reload();
  await page.getByLabel('Buscar registros').fill('EXC-100');
  await expect(page.locator('tbody')).toContainText('EXC-100');
  await cerrarSesion(page);
  await iniciarSesion(page, 'prueba.captura');
  await page.locator('#selector-usuario').click();
  await expect(
    page.getByRole('button', { name: 'Catálogos y carga inicial', exact: true }),
  ).toHaveCount(0);
});
