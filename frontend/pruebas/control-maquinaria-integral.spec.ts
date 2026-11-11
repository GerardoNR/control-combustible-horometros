import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ExcelJS from 'exceljs';
import {
  iniciarSesion,
  iniciarSesionConMuestraCompleta,
  navegar,
  confirmarCambios,
} from './ayudantes';
const ejecutar = promisify(execFile);
test.use({ timezoneId: 'America/Monterrey' });

test('crea fuentes, sincroniza residentes, conserva históricos y exporta las mismas alertas', async ({
  page,
}, informacion) => {
  test.setTimeout(90000);
  await page.clock.setFixedTime(new Date('2026-11-08T18:00:00Z'));
  await page.goto('/maquinarias');
  await iniciarSesion(page, undefined, undefined, true);
  await page.getByRole('button', { name: 'Registrar maquinaria', exact: true }).click();
  await page.getByLabel('Número económico *').fill('AUD-501');
  await page.getByLabel('Placas *').fill('NL-PRUEBA');
  await page.getByLabel('Tipo de maquinaria *').fill('Excavadora');
  await page.getByLabel('Marca *').fill('Marca de prueba');
  await page.getByLabel('Modelo *', { exact: true }).fill('Modelo de prueba');
  await page.getByLabel('Horómetro base (h) *').fill('1000');
  await page.getByLabel('Ingeniero residente', { exact: true }).fill('Residente uno de prueba');
  await page.getByLabel('PK / Ubicación', { exact: true }).fill('PK 556+060');
  await page.getByLabel('Fecha de asignación *').fill('2026-11-07');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const encabezados = await page.locator('thead th').allTextContents();
  expect(encabezados.slice(-4)).toEqual([
    'Residente / PK',
    'Último mantenimiento',
    'Próximo mantenimiento',
    'Acciones',
  ]);
  await expect(page.locator('main .bi-truck-front')).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Residente', exact: true }).click();
  await page.getByRole('button', { name: 'Asignar operador vigente', exact: true }).click();
  await page.getByLabel('Nuevo operador *').fill('Operador uno de prueba');
  await page.getByLabel('Fecha de inicio *').fill('2026-11-07');
  await page.getByLabel('Motivo de la asignación o cambio *').fill('Asignación de prueba aislada');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await page.getByRole('tab', { name: 'Consumo', exact: true }).click();
  await page.getByLabel('Mínimo esperado (L/h)', { exact: true }).fill('8');
  await page.getByLabel('Máximo normal (L/h) *', { exact: true }).fill('12');
  await page.getByLabel('Máximo de advertencia (L/h) *', { exact: true }).fill('15');
  await page.getByLabel('Horas mínimas por día operativo', { exact: true }).fill('8');
  await page
    .getByLabel('Referencia operativa validada *')
    .fill('Rangos ficticios autorizados para esta prueba aislada');
  await page.getByLabel('Validado por *').fill('Supervisión de prueba');
  await page.getByRole('button', { name: 'Guardar límites de consumo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  async function mantenimiento(fecha: string, tipo: string) {
    await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
    await page.getByRole('tab', { name: 'Mantenimiento', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Próximo servicio', exact: true })).toBeVisible();
    await page.getByLabel('Fecha del servicio *').fill(fecha);
    await page.getByLabel('Tipo de servicio *').fill(tipo);
    await confirmarCambios(page);
    await page.getByRole('button', { name: 'Guardar mantenimiento', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await mantenimiento('2026-11-07', 'Primer servicio de prueba');
  await expect(page.locator('tbody')).toContainText('Objetivo: 1,250 h');
  await expect(page.locator('tbody')).toContainText('Avance pendiente de verificar');
  const maquinariaId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('marimba.datos.v1')!).maquinarias[0].id,
  );
  await navegar(page, informacion, 'Horómetros');
  async function lectura(final: string, primera = false) {
    await page.getByRole('button', { name: 'Registrar horómetro', exact: true }).click();
    await page.getByLabel('Maquinaria *').selectOption(maquinariaId);
    await page.getByLabel('Lectura final (h) *').fill(final);
    await page.getByLabel('Régimen de operación', { exact: true }).selectOption('Trabajo');
    if (primera) await page.getByLabel('Confirmo lectura inicial supervisada').check();
    await confirmarCambios(page);
    await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await lectura('1004', true);
  await navegar(page, informacion, 'Combustible');
  await page.getByRole('button', { name: 'Registrar suministro', exact: true }).click();
  await page.getByLabel('Maquinaria *').selectOption(maquinariaId);
  await page.getByLabel('Litros solicitados *').fill('80');
  await page.getByLabel('Litros cargados *').fill('80');
  await page.getByLabel('Régimen de operación', { exact: true }).selectOption('Trabajo');
  await page.getByText('Datos complementarios del suministro', { exact: true }).click();
  await page.getByLabel('Número de orquesta').fill('ORQ-AUD-501');
  await page.getByLabel('Nombre del despachador', { exact: true }).fill('Despachador de prueba');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navegar(page, informacion, 'Control Diario');
  await expect(page.locator('tbody')).toContainText('20 L/h');
  await expect(page.getByRole('region', { name: 'Alertas de maquinaria' })).toHaveCount(0);
  const filaAlerta = page.locator('tbody tr').first();
  const alturaFila = (await filaAlerta.boundingBox())!.height;
  await page.getByRole('button', { name: /Consultar alerta Crítica/ }).click();
  const modalAlerta = page.getByRole('dialog');
  await expect(modalAlerta).toContainText('Consulta de alerta');
  await expect(modalAlerta).toContainText('Consumo superior al rango técnico');
  await expect(modalAlerta).toContainText('Consumo técnico esperado');
  expect((await filaAlerta.boundingBox())!.height).toBe(alturaFila);
  await modalAlerta.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(modalAlerta).toHaveCount(0);
  await navegar(page, informacion, 'Maquinarias');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Residente', exact: true }).click();
  await page.getByLabel('Ingeniero residente', { exact: true }).fill('Residente dos de prueba');
  await page.getByLabel('PK / Ubicación', { exact: true }).fill('PK 120+500');
  await page.getByLabel('Fecha de asignación *').fill('2026-11-08');
  await page.getByLabel('Motivo del cambio *').fill('Relevo de prueba con historial conservado');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar residente y ubicación', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('marimba.datos.v1')!).maquinarias[0].periodosResidentes
            .length,
      ),
    )
    .toBe(2);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem('marimba.datos.v1')!,
          ).maquinarias[0].periodosResidentes.find((p: { fin: string | null }) => p.fin === null)
            .nombre,
      ),
    )
    .toBe('Residente dos de prueba');
  await page.getByRole('button', { name: 'Cambiar operador vigente', exact: true }).click();
  await page.getByLabel('Nuevo operador *').fill('Operador dos de prueba');
  await page.getByLabel('Fecha de inicio *').fill('2026-11-08');
  await page.getByLabel('Motivo de la asignación o cambio *').fill('Relevo de operador de prueba');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem('marimba.datos.v1')!).asignacionesOperadores.map(
          (periodo: { operador: string; fin: string | null }) => [periodo.operador, periodo.fin],
        ),
      ),
    )
    .toEqual([
      ['Operador uno de prueba', expect.any(String)],
      ['Operador dos de prueba', null],
    ]);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await mantenimiento('2026-11-08', 'Segundo servicio de prueba');
  await expect(page.locator('tbody')).toContainText('Trabajadas desde el servicio: 0 h');
  await expect(page.locator('tbody')).toContainText('250 h restantes');
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'));
  await navegar(page, informacion, 'Horómetros');
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-08');
  await lectura('1008');
  await expect(page.locator('tbody')).toContainText('Operador uno de prueba');
  await expect(page.locator('tbody')).toContainText('Operador dos de prueba');
  await navegar(page, informacion, 'Maquinarias');
  await expect(page.locator('tbody')).toContainText('Trabajadas desde el servicio: 4 h');
  await expect(page.locator('tbody')).toContainText('246 h restantes');
  const tablaMaquinarias = page.getByRole('region', {
    name: 'Tabla de registros, desplazable horizontalmente',
  });
  await tablaMaquinarias.evaluate((elemento) => {
    elemento.scrollLeft = elemento.scrollWidth;
  });
  await tablaMaquinarias.screenshot({ path: informacion.outputPath('tabla-mantenimiento.png') });
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  const proximo = page.getByRole('region', { name: 'Próximo servicio', exact: true });
  await expect(proximo).toContainText('1,008 h');
  await expect(proximo).toContainText('1,204 h');
  await expect(proximo).toContainText('1,254 h');
  await expect(proximo).toContainText('246 h');
  await expect(proximo.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1.6');
  await proximo.scrollIntoViewIfNeeded();
  await page
    .getByRole('dialog')
    .screenshot({ path: informacion.outputPath('consulta-mantenimiento.png') });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Mantenimiento', exact: true }).click();
  await expect(proximo).toContainText('1,254 h');
  await expect(proximo).toContainText('246 h');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await navegar(page, informacion, 'Combustible');
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-08');
  await expect(page.locator('tbody')).toContainText(/Residente uno de prueba/);
  await expect(page.locator('tbody')).toContainText(/PK 556\+060/);
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Residente uno de prueba');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Fecha desde', { exact: true }).fill('2026-11-08');
  await page.getByLabel('Filtrar por maquinaria').selectOption(maquinariaId);
  await page.getByLabel('Filtrar por operador').fill('Operador uno');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Residente dos de prueba');
  await expect(page.locator('tbody')).not.toContainText(/1\)|00:00|Residente uno/);
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
  const archivo = await descarga;
  const rutaExcel = informacion.outputPath('residente-pk-filtrado.xlsx');
  await archivo.saveAs(rutaExcel);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(new Uint8Array(await readFile(rutaExcel)).buffer);
  expect(libro.worksheets).toHaveLength(1);
  const hoja = libro.worksheets[0];
  expect(hoja.columnCount).toBe(11);
  expect(hoja.rowCount).toBe(6);
  expect(hoja.getCell('E5').value).toBe('Residente dos de prueba\nPK 120+500');
  expect(hoja.getCell('D5').value).toBe('Operador uno de prueba');
  expect([hoja.getCell('H5').value, hoja.getCell('I5').value, hoja.getCell('J5').value]).toEqual([
    4, 80, 20,
  ]);
  expect(hoja.getCell('K5').value).toBe('Crítica');
  expect(hoja.getCell('K5').fill).toMatchObject({ fgColor: { argb: 'FFFCE8E8' } });
  expect(hoja.getCell('K5').note).toContain('umbral crítico');
  const descargaPdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const pdf = await descargaPdf;
  const rutaPdf = informacion.outputPath('residente-pk-filtrado.pdf');
  await pdf.saveAs(rutaPdf);
  const { stdout: texto } = await ejecutar('pdftotext', ['-layout', rutaPdf, '-']);
  expect(texto).toContain('Residente dos de prueba');
  expect(texto).toContain('PK 120+500');
  expect(texto).toContain('Operador uno de prueba');
  expect(texto).toContain('Crítica');
  expect(texto).not.toContain('umbral crítico');
  expect(texto).not.toContain('Rango técnico:');
  expect(texto.match(/TOTAL GENERAL/g)).toHaveLength(1);
  await navegar(page, informacion, 'Maquinarias');
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Historial', exact: true }).click();
  await page.getByText('Residentes y ubicaciones', { exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Historial cronológico de residentes' }),
  ).toContainText('Residente uno de prueba');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  const base = await page.evaluate(() => JSON.parse(localStorage.getItem('marimba.datos.v1')!));
  expect(base.maquinarias[0]).toMatchObject({ consumoMinimoEsperado: 8, horasMinimasDiarias: 8 });
  expect(base.mantenimientos).toHaveLength(2);
  expect(base.combustible[0].nombreResidente).toBe('Residente uno de prueba');
});

test('sin parámetros y con combustible sin horas distingue Sin evaluar de Revisar', async ({
  page,
}, informacion) => {
  await page.goto('/control-diario');
  await iniciarSesionConMuestraCompleta(page);
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    const equipo = base.maquinarias[0];
    for (const campo of [
      'consumoNormalMaximo',
      'consumoAdvertenciaMaximo',
      'referenciaConsumo',
      'validadoConsumoPor',
      'fechaValidacionConsumo',
    ])
      delete equipo[campo];
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  const alertaSinEvaluar = page.getByRole('button', { name: /Consultar alerta Sin evaluar/ });
  await alertaSinEvaluar.click();
  await expect(page.getByRole('dialog')).toContainText('Faltan parámetros para evaluar');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    base.horometros = base.horometros.filter(
      (registro: { maquinariaId: string }) => registro.maquinariaId !== 'prueba-maq-01',
    );
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  await page.getByRole('button', { name: /Consultar alerta Revisar/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Combustible registrado sin horas válidas');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await navegar(page, informacion, 'Maquinarias');
  await expect(page.locator('main .bi-truck-front')).toHaveCount(0);
});
