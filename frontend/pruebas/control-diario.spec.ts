import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { iniciarSesion } from './ayudantes';

test.use({ timezoneId: 'America/Monterrey' });
test('filtra periodos locales, totaliza una vez y descarga todas las páginas en Excel y PDF', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-08T05:30:00Z')); // Todavía es 7 de noviembre local.
  await page.goto('/control-diario');
  await iniciarSesion(page);
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    const lectura = base.horometros[0],
      carga = base.combustible[0];
    const fechas = [
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ];
    base.horometros = fechas.map((fecha, indice) => ({
      ...lectura,
      id: `h-${indice}`,
      fecha,
      fechaAsignacion: fecha,
      operador: `Operador-${String(indice + 1).padStart(2, '0')}`,
      lecturaInicial: 1000 + indice * 8,
      lecturaFinal: 1000 + indice * 8 + (indice === 0 ? 2 : 8),
    }));
    base.combustible = fechas.map((fecha, indice) => ({
      ...carga,
      id: `c-${indice}`,
      fecha,
      operador: `Operador-${String(indice + 1).padStart(2, '0')}`,
      litrosCargados: 80,
    }));
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  const desde = page.getByLabel('Fecha desde', { exact: true });
  const hasta = page.getByLabel('Fecha hasta', { exact: true });
  const filas = page
    .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
    .locator('tbody tr');
  const resumen = page.getByRole('region', { name: 'Resumen filtrado' });
  const tarjeta = (titulo: string) => resumen.locator('article').filter({ hasText: titulo });
  expect(
    await resumen.evaluate((elemento) => {
      const bitacora = document.querySelector('section[aria-label="Bitácora de operaciones"]');
      return (
        !!bitacora &&
        !!(elemento.compareDocumentPosition(bitacora) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    }),
  ).toBe(true);

  await expect(desde).toHaveValue('2026-11-07');
  await expect(hasta).toHaveValue('2026-11-07');
  await expect(desde.locator('..').locator('time')).toHaveText('07/11/2026');
  await expect(filas).toHaveCount(1);
  await expect(page.locator('table')).toHaveCount(1);
  const encabezados = page.getByRole('region', {
    name: 'Tabla de registros, desplazable horizontalmente',
  }).locator('thead th');
  const textosEncabezado = await encabezados.allTextContents();
  expect(textosEncabezado).toContain('Residente / PK');
  expect(textosEncabezado).not.toContain('Residente');
  expect(textosEncabezado).not.toContain('PK/Ubicación');
  await expect(filas.first().locator('td').nth(4)).toContainText('PK:');
  await expect(page.getByText('Indicadores por maquinaria', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Umbral de pocas horas por día operativo')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Bitácora de operaciones' })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(4);
  await expect(tarjeta('Maquinarias con registros')).toContainText('1 registros filtrados');
  await expect(tarjeta('Horas trabajadas')).toContainText('8 h');
  await expect(tarjeta('Litros suministrados')).toContainText('80 L');
  await desde.fill('2026-11-09');
  await expect(page.getByRole('alert')).toContainText('anterior o igual');
  await expect(desde).toHaveValue('2026-11-07');
  await expect(page.getByRole('group', { name: 'Periodos rápidos' })).toHaveCount(0);
  await desde.fill('2026-11-01');
  await expect(desde).toHaveValue('2026-11-01');
  await expect(filas).toHaveCount(7);
  await expect(tarjeta('Horas trabajadas')).toContainText('56 h');
  await desde.fill('');
  await hasta.fill('');
  await expect(desde).toHaveValue('');
  await expect(hasta).toHaveValue('');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-1');
  await page.getByLabel('Buscar registros').fill('EXC-001');
  await page.getByLabel('Filtrar por operador').fill('Operador-');
  await expect(filas).toHaveCount(8);
  await expect(tarjeta('Horas trabajadas')).toContainText('90 h');
  await expect(tarjeta('Litros suministrados')).toContainText('960 L');
  await expect(tarjeta('Consumo global L/h')).toContainText('10.667 L/h');
  await page.getByLabel('Página siguiente').click();
  await expect(filas).toHaveCount(4);
  async function verificarDescargas(
    operadores: string[],
    horas: number,
    litros: number,
    periodo: string,
  ) {
    const esperaExcel = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
    const excel = await esperaExcel;
    expect(excel.suggestedFilename()).toMatch(/\.xlsx$/);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(new Uint8Array(await readFile((await excel.path())!)).buffer);
    const hoja = libro.getWorksheet('Control Diario')!;
    const exportados = Array.from(
      { length: operadores.length },
      (_, i) => hoja.getCell(`D${5 + i}`).value,
    );
    expect(exportados.sort()).toEqual([...operadores].sort());
    expect(hoja.rowCount).toBe(5 + operadores.length);
    expect(hoja.getCell(`H${hoja.rowCount}`).value).toBe(horas);
    expect(hoja.getCell(`I${hoja.rowCount}`).value).toBe(litros);
    expect(hoja.getCell(`J${hoja.rowCount}`).value).toBe(litros / horas);
    expect(hoja.getCell('A3').value).toContain(periodo);
    expect(libro.worksheets.map((hoja) => hoja.name)).toEqual(['Control Diario']);
    const esperaPdf = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
    const pdf = await esperaPdf;
    const contenido = (await readFile((await pdf.path())!)).toString('latin1');
    expect(contenido.startsWith('%PDF')).toBe(true);
    expect(contenido).toContain('Control de Maquinaria');
    expect(contenido).toContain(periodo);
    expect(contenido.match(/\(Operador-\d{2}\)/g)?.sort()).toEqual(
      [...operadores].sort().map((nombre) => `(${nombre})`),
    );
    expect(contenido).toContain(`(${horas}) Tj`);
    expect(contenido).toContain(`(${litros}) Tj`);
    expect(contenido).not.toContain('Actividad');
  }
  await verificarDescargas(
    Array.from({ length: 12 }, (_, i) => `Operador-${String(i + 1).padStart(2, '0')}`),
    90,
    960,
    'Periodo: 27/10/2026 al 07/11/2026',
  );
  await desde.fill('2026-11-02');
  await hasta.fill('2026-11-04');
  await expect(filas).toHaveCount(3);
  await expect(tarjeta('Horas trabajadas')).toContainText('24 h');
  await page.getByLabel('Filtrar por operador').fill('Operador-08');
  await expect(filas).toHaveCount(1);
  await verificarDescargas(['Operador-08'], 8, 80, 'Periodo: 02/11/2026 al 04/11/2026');
  await page.getByLabel('Buscar registros').fill('Sin resultados');
  for (const tipo of ['Excel', 'PDF']) {
    await page.getByRole('button', { name: `Exportar ${tipo}`, exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('No hay resultados');
  }
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(desde).toHaveValue('2026-11-07');
  await expect(hasta).toHaveValue('2026-11-07');
  await expect(page.getByLabel('Filtrar por maquinaria')).toHaveValue('');
  await expect(page.getByLabel('Filtrar por operador')).toHaveValue('');
  await expect(page.getByLabel('Buscar registros')).toHaveValue('');
  await expect(filas).toHaveCount(1);
  await expect(desde).toHaveValue('2026-11-07');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: informacion.outputPath('control-diario.png'), fullPage: true });
});
