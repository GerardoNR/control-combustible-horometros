import { contrasenaPrueba } from './datos/usuarios';
import {
  indiceExcel,
  residenteUbicacionExcel,
} from '../src/modulos/control-diario/servicios/reporte-excel';
import { confirmarCambios } from './ayudantes';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { iniciarSesion, iniciarSesionConMuestraCompleta, navegar } from './ayudantes';
import { crearMuestraFicticia } from './datos/operaciones-completas';
import { consolidarControlDiario } from '../src/modulos/control-diario/servicios/consolidacion';

test.use({ timezoneId: 'America/Monterrey' });
test('carga 15/15/15, conserva relaciones y exporta todos los filtrados desde otra página', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-08T18:00:00Z'));
  await page.goto('/maquinarias');
  await page.evaluate(async () => {
    const rutaFixture = '/pruebas/datos/operaciones-completas.ts';
    const modulo = await import(/* @vite-ignore */ rutaFixture);
    localStorage.setItem(
      'marimba.datos.v1',
      JSON.stringify(modulo.crearMuestraFicticia('2026-11-08')),
    );
  });
  await iniciarSesion(page, 'prueba.admin', contrasenaPrueba, true);
  const baseInicial = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('marimba.datos.v1')!),
  );
  expect([
    baseInicial.maquinarias.length,
    baseInicial.horometros.length,
    baseInicial.combustible.length,
  ]).toEqual([15, 15, 15]);
  expect(baseInicial['control-diario']).toEqual([]);
  for (const modulo of ['Maquinarias', 'Horómetros', 'Combustible']) {
    await navegar(page, informacion, modulo);
    if (modulo === 'Maquinarias') {
      await page.getByRole('button', { name: 'Consultar registro', exact: true }).first().click();
      const dialogo = page.getByRole('dialog');
      const actividad = dialogo.locator('details').filter({ hasText: 'Actividad por periodo' });
      await actividad.locator('summary').click();
      await expect(actividad.locator('#actividad-desde')).toHaveValue('2026-11-08');
      await expect(actividad.locator('#actividad-hasta')).toHaveValue('2026-11-08');
      await actividad.locator('#actividad-desde').fill('2026-11-06');
      await expect(actividad).toContainText('Horas registradas');
      await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
    }
    if (modulo !== 'Maquinarias') {
      await expect(page.getByLabel('Desde', { exact: true })).toHaveValue('2026-11-08');
      await expect(page.getByLabel('Hasta', { exact: true })).toHaveValue('2026-11-08');
      await page.getByLabel('Desde', { exact: true }).fill('');
      await page.getByLabel('Hasta', { exact: true }).fill('');
    }
    const tabla = page.getByRole('region', {
      name: 'Tabla de registros, desplazable horizontalmente',
    });
    await expect(tabla.locator('tbody tr')).toHaveCount(8);
    await expect(tabla).not.toContainText(/Sin registrar|Sin asignar/);
    await page.getByLabel('Página siguiente').click();
    await expect(tabla.locator('tbody tr')).toHaveCount(7);
    await expect(tabla).not.toContainText(/Sin registrar|Sin asignar/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Fecha desde', { exact: true }).fill('2026-11-06');
  const resumen = page.getByRole('region', { name: 'Resumen filtrado' });
  await expect(resumen).toContainText('14 registros filtrados');
  await expect(resumen.locator('article').filter({ hasText: 'Horas trabajadas' })).toContainText(
    '100 h',
  );
  await expect(
    resumen.locator('article').filter({ hasText: 'Litros suministrados' }),
  ).toContainText('1,410 L');
  await expect(resumen.locator('article').filter({ hasText: 'Consumo global' })).toContainText(
    '14.1 L/h',
  );
  await page.getByLabel('Página siguiente').click();
  const filas = page
    .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
    .locator('tbody tr');
  await expect(filas).toHaveCount(6);
  const esperadas = consolidarControlDiario(crearMuestraFicticia('2026-11-08'));
  async function exportar(esperados: typeof esperadas) {
    const descargaExcel = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
    const excel = await descargaExcel;
    const bytes = await readFile((await excel.path())!);
    expect(bytes.length).toBeGreaterThan(1000);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(new Uint8Array(bytes).buffer);
    const hoja = libro.getWorksheet('Control Diario')!;
    expect(hoja.rowCount).toBe(5 + esperados.length);
    for (const [indice, fila] of esperados.entries()) {
      const numeroFila = 5 + indice;
      expect((hoja.getCell(`A${numeroFila}`).value as Date).toISOString().slice(0, 10)).toBe(
        fila.fecha,
      );
      expect(hoja.getCell(`B${numeroFila}`).value).toBe(fila.numeroEconomico);
      expect(hoja.getCell(`H${numeroFila}`).value).toBe(fila.horas);
      expect(hoja.getCell(`I${numeroFila}`).value).toBe(fila.litros);
      expect(hoja.getCell(`J${numeroFila}`).value).toBe(fila.litrosHora);
      expect(hoja.getCell(`E${numeroFila}`).value).toBe(residenteUbicacionExcel(fila));
      expect(hoja.getCell(`F${numeroFila}`).value).toBe(fila.lecturasHorometro?.[0].inicial);
      expect(hoja.getCell(`G${numeroFila}`).value).toBe(fila.lecturasHorometro?.at(-1)?.final);
      expect(hoja.getCell(numeroFila, indiceExcel('alerta')).value).toBe(
        fila.evaluacion?.nivel ?? 'Sin evaluar',
      );
      expect(hoja.getCell(`D${numeroFila}`).value).toBe(fila.operador);
    }
    const horas = esperados.reduce((total, fila) => total + fila.horas!, 0);
    const litros = esperados.reduce((total, fila) => total + fila.litros!, 0);
    expect(hoja.getCell(`H${hoja.rowCount}`).value).toBe(horas);
    expect(hoja.getCell(`I${hoja.rowCount}`).value).toBe(litros);
    expect(libro.worksheets.map((hoja) => hoja.name)).toEqual(['Control Diario']);
    const descargaPdf = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
    const pdf = await descargaPdf;
    const contenido = await readFile((await pdf.path())!);
    expect(contenido.length).toBeGreaterThan(1000);
    const texto = contenido.toString('latin1');
    expect(texto.startsWith('%PDF')).toBe(true);
    expect(texto).toContain('TOTAL');
    expect(texto).toContain('08/11/2026');
    for (const fila of esperados) expect(texto).toContain(fila.numeroEconomico);
    if (esperados.length > 20)
      expect((texto.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(texto).toContain(`(${horas}) Tj`);
  }
  await exportar(esperadas);
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  await page.getByLabel('Filtrar por operador').fill('José Luis');
  await page.getByLabel('Buscar registros').fill('EXC-101');
  await page.getByLabel('Fecha hasta', { exact: true }).fill('2026-11-07');
  await expect(filas).toHaveCount(1);
  const filtradas = esperadas.filter(
    (fila) =>
      fila.maquinariaId === 'prueba-maq-01' &&
      fila.operador.includes('José Luis') &&
      fila.fecha <= '2026-11-07',
  );
  await exportar(filtradas);
  await page.screenshot({ path: informacion.outputPath('muestra-filtrada.png'), fullPage: true });
});

test('oculta el control de muestra y conserva los cambios guardados y las capturas', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-08T18:00:00Z'));
  await page.goto('/maquinarias');
  await iniciarSesionConMuestraCompleta(page);
  await page.getByLabel('Buscar registros').fill('EXC-101');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByLabel('Modelo *', { exact: true }).fill('Modelo modificado por usuario');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.getByLabel('Buscar registros').fill('EXC-101');
  await expect(page.locator('tbody')).toContainText('Modelo modificado por usuario');
  const anterior = await page.evaluate(() => localStorage.getItem('marimba.datos.v1'));
  await expect(page.getByRole('button', { name: 'Datos de prueba', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(anterior);
  await navegar(page, informacion, 'Horómetros');
  await page.getByRole('button', { name: 'Registrar horómetro', exact: true }).click();
  await page.getByLabel('Maquinaria *').selectOption('prueba-maq-01');
  await expect(page.getByLabel('Lectura inicial (h) *')).toHaveValue('2421');
  await expect(page.getByLabel('Operador *', { exact: true })).toHaveValue(
    'José Luis García Mendoza',
  );
  await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click();
  await navegar(page, informacion, 'Combustible');
  await page.getByRole('button', { name: 'Registrar suministro', exact: true }).click();
  await page.getByLabel('Maquinaria *').selectOption('prueba-maq-01');
  await expect(page.getByLabel('Operador *', { exact: true })).toHaveValue(
    'José Luis García Mendoza',
  );
  await page
    .getByLabel('Nombre del residente', { exact: true })
    .fill('Adriana Isabel Salazar Pérez');
  await page.keyboard.press('Tab');
  await page.locator('summary').filter({ hasText: 'Datos complementarios' }).click();
  await expect(page.getByLabel('PK donde trabaja el residente')).toHaveValue('012+350');
  await page.getByLabel('Litros solicitados *').fill('100');
  await page.getByLabel('Litros cargados *').fill('90');
  await page.getByLabel('Número de orquesta', { exact: true }).fill('ORQ-001');
  await page
    .getByLabel('Nombre del despachador', { exact: true })
    .fill('Eduardo Iván Pérez Rosales');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  await page.getByRole('button', { name: 'Eliminar registro', exact: true }).first().click();
  await page.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('permite capturas nuevas, edición, eliminación y cambios de responsables sin reescribir el pasado', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-08T18:00:00Z'));
  await page.goto('/horometros');
  await iniciarSesionConMuestraCompleta(page);
  const fuentes = await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    return { horometros: base.horometros, combustible: base.combustible };
  });
  await page.getByRole('button', { name: 'Registrar horómetro', exact: true }).click();
  await page.getByLabel('Maquinaria *').selectOption('prueba-maq-01');
  await expect(page.getByLabel('Lectura inicial (h) *')).toHaveValue('2421');
  await page.getByLabel('Lectura final (h) *').fill('2424');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  const nueva = page.locator('tbody tr').filter({ hasText: '2,424' });
  await nueva.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByLabel('Lectura final (h) *').fill('2425');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  const editada = page.locator('tbody tr').filter({ hasText: '2,425' });
  await editada.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('José Luis García Mendoza');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await editada.getByRole('button', { name: 'Eliminar registro', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navegar(page, informacion, 'Maquinarias');
  await page.getByLabel('Buscar registros').fill('EXC-101');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Residente', exact: true }).click();
  await page
    .getByLabel('Ingeniero residente', { exact: true })
    .fill('Verónica Patricia Castillo Ramos');
  await page.getByLabel('Fecha de asignación *').fill('2026-11-08');
  await page
    .getByLabel('Motivo del cambio', { exact: false })
    .fill('Cambio ficticio para verificar historial');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar residente y ubicación' }).click();
  await expect(page.getByLabel('Ingeniero residente', { exact: true })).toHaveValue(
    'Verónica Patricia Castillo Ramos',
  );
  await page.getByRole('button', { name: 'Cambiar operador vigente', exact: true }).click();
  await page.getByLabel('Nuevo operador *').fill('Ernesto Julián Castro Molina');
  await page.getByLabel('Fecha de inicio *').fill('2026-11-08');
  await page
    .getByLabel('Motivo de la asignación o cambio *')
    .fill('Relevo de prueba posterior a las capturas');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cambiar operador vigente' })).toBeVisible();
  await page.getByRole('tab', { name: 'Mantenimiento', exact: true }).click();
  await expect(page.getByLabel('Horómetro del servicio (h) *')).toHaveValue('2421');
  await page.getByLabel('Tipo de servicio *').fill('Servicio de prueba posterior a las capturas');
  await page.getByLabel('Observaciones', { exact: true }).fill('Verificación ficticia de filtros');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar mantenimiento' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('tbody')).toContainText('Verde · En rango');
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Verónica Patricia Castillo Ramos');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  const despues = await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    return {
      horometros: base.horometros.filter((fila: { id: string }) => fila.id.startsWith('prueba-')),
      combustible: base.combustible,
      periodos: base.maquinarias[0].periodosResidentes,
    };
  });
  expect(despues.horometros).toEqual(fuentes.horometros);
  expect(despues.combustible).toEqual(fuentes.combustible);
  expect(despues.periodos).toHaveLength(3);
  await page.getByRole('button', { name: 'Registrar maquinaria', exact: true }).click();
  await page.getByLabel('Número económico *').fill('RET-116');
  await page.getByLabel('Placas *').fill('NL-6200-M');
  await page.getByLabel('Tipo de maquinaria *').fill('Retroexcavadora');
  await page.getByLabel('Marca *').fill('JCB');
  await page.getByLabel('Modelo *', { exact: true }).fill('3CX');
  await page.getByLabel('Horómetro base (h) *').fill('100');
  await page
    .getByLabel('Ingeniero residente', { exact: true })
    .fill('Adriana Isabel Salazar Pérez');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('marimba.datos.v1')!).maquinarias.length,
    ),
  ).toBe(16);
});
