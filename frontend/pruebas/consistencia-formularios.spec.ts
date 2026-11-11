import { confirmarCambios } from './ayudantes';
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { iniciarSesion, iniciarSesionConMuestraCompleta, navegar } from './ayudantes';

test.use({ timezoneId: 'America/Monterrey' });
test('agrega, consulta, edita y exporta el suministro actualizado conservando su historial', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'));
  await page.goto('/combustible');
  await iniciarSesionConMuestraCompleta(page);
  await expect(page.getByText('Litros suministrados por equipo', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Recargar datos', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar suministro', exact: true }).click();
  let modal = page.getByRole('dialog');
  await expect(modal.getByLabel(/Actividad|Ingeniero/)).toHaveCount(0);
  await modal.getByLabel('Maquinaria *').selectOption('prueba-maq-01');
  await modal.getByLabel('Hora de carga *').fill('15:45');
  await modal.getByLabel('Litros solicitados *').fill('50');
  await modal.getByLabel('Litros cargados *').fill('30');
  await expect(modal.getByLabel('Operador *', { exact: true })).toHaveValue(
    'José Luis García Mendoza',
  );
  await modal
    .getByLabel('Nombre del residente', { exact: true })
    .fill('Adriana Isabel Salazar Pérez');
  await page.keyboard.press('Tab');
  await modal.getByText('Datos complementarios del suministro', { exact: true }).click();
  await expect(modal.getByLabel('PK donde trabaja el residente')).toHaveValue('012+350');
  await modal.getByLabel('Número de orquesta', { exact: true }).fill('ORQ-REV');
  await modal
    .getByLabel('Nombre del despachador', { exact: true })
    .fill('Eduardo Iván Pérez Rosales');
  await confirmarCambios(page);
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.getByLabel('Buscar registros').fill('ORQ-REV');
  const fila = page.locator('tbody tr');
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText('30 L');
  await fila.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  modal = page.getByRole('dialog');
  await expect(modal).toContainText('30 L');
  await expect(modal).toContainText('15:45');
  await expect(modal).toContainText('012+350');
  await expect(modal).not.toContainText('Actividad / Frente');
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await fila.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await expect(modal.getByLabel('Litros cargados *')).toHaveValue('30');
  await modal.getByLabel('Litros cargados *').fill('40');
  await confirmarCambios(page);
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(fila).toContainText('40 L');
  await fila.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await expect(modal.getByRole('region', { name: 'Maquinaria y suministro' })).toContainText(
    '40 L',
  );
  await modal.getByText('Historial de modificaciones', { exact: true }).click();
  await expect(modal.locator('del')).toHaveText('30 L');
  await expect(modal).toContainText('09/11/2026');
  await expect(modal).toContainText('EXC-101 · Excavadora');
  await expect(modal).not.toContainText('prueba-maq-01');
  await expect(modal.getByRole('button', { name: /Editar|Guardar|Cambiar|Eliminar/ })).toHaveCount(
    0,
  );
  await page.screenshot({ path: informacion.outputPath('consulta-suministro.png') });
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  await page.getByLabel('Buscar registros').fill('ORQ-REV');
  await expect(page.locator('tbody')).toContainText('40 L');
  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  await page.getByLabel('Filtrar por operador').fill('José Luis');
  const tablaDiaria = page.getByRole('region', {
    name: 'Tabla de registros, desplazable horizontalmente',
  });
  await expect(tablaDiaria.locator('tbody tr')).toHaveCount(1);
  await expect(tablaDiaria.locator('tbody')).toContainText('140 L');
  await expect(tablaDiaria.locator('tbody')).toContainText('17.5 L/h');
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
  const archivo = await descarga;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(new Uint8Array(await readFile((await archivo.path())!)).buffer);
  const hoja = libro.getWorksheet('Control Diario')!;
  expect(hoja.getCell('H5').value).toBe(8);
  expect(hoja.getCell('I5').value).toBe(140);
  expect(hoja.getCell('J5').value).toBe(17.5);
  const descargaPdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const pdf = await descargaPdf;
  const contenido = (await readFile((await pdf.path())!)).toString('latin1');
  expect(contenido).toContain('EXC-101');
  expect(contenido).toContain('(140) Tj');
  expect(contenido).toContain('(17.5) Tj');
  await navegar(page, informacion, 'Horómetros');
  await expect(page.getByRole('button', { name: 'Recargar datos', exact: true })).toHaveCount(0);
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).first().click();
  await page
    .getByRole('dialog')
    .getByText('Movimientos de operadores', { exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /Cambiar operador|Registrar asignación/ }),
  ).toHaveCount(0);
});

test('editar un suministro anterior conserva los campos retirados sin ofrecerlos como captura', async ({
  page,
}) => {
  await page.goto('/combustible');
  await iniciarSesion(page);
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    base.combustible[0].actividad = 'Trabajo original conservado';
    base.combustible[0].frenteId = 'frente-anterior';
    base.combustible[0].responsableLegado = 'Responsable original conservado';
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-1');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel(/Actividad|Ingeniero/)).toHaveCount(0);
  await page.getByLabel('Litros cargados *').fill('96');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const conservado = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('marimba.datos.v1')!).combustible.find(
      (r: { id: string }) => r.id === 'com-1',
    ),
  );
  expect(conservado).toMatchObject({
    actividad: 'Trabajo original conservado',
    frenteId: 'frente-anterior',
    responsableLegado: 'Responsable original conservado',
    litrosCargados: 96,
  });
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByText('Datos históricos del formato anterior', { exact: true }).click();
  await expect(modal.getByText('Trabajo original conservado', { exact: true })).toBeVisible();
  await expect(modal.getByText('Responsable original conservado', { exact: true })).toBeVisible();
});
