import { clavePk } from '../src/compartido/utilidades/pk';
import type { BaseDatos } from '../src/compartido/tipos/datos';
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { confirmarCambios, iniciarSesionConMuestraCompleta, navegar } from './ayudantes';

test.use({ timezoneId: 'America/Monterrey' });

test('muestra residente y PK juntos con el mismo encabezado en Maquinarias y Combustible', async ({
  page,
}, informacion) => {
  await page.goto('/maquinarias');
  await iniciarSesionConMuestraCompleta(page);

  for (const modulo of ['Maquinarias', 'Combustible']) {
    if (modulo === 'Combustible') await navegar(page, informacion, modulo);
    const tabla = page.getByRole('region', {
      name: 'Tabla de registros, desplazable horizontalmente',
    });
    const encabezado = tabla.getByRole('columnheader', { name: 'Residente / PK', exact: true });
    await expect(encabezado).toBeVisible();

    const indice = await encabezado.evaluate((elemento) =>
      Array.from(elemento.parentElement!.children).indexOf(elemento),
    );
    const celda = tabla.locator('tbody tr').first().locator('td').nth(indice);
    await expect(celda.locator('span').first()).not.toHaveText('Sin asignar');
    await expect(celda.locator('small')).toContainText(/^PK: /);
  }
});

test('sincroniza el PK guardado desde Combustible sin reescribir la captura histórica', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'));
  await page.goto('/combustible');
  await iniciarSesionConMuestraCompleta(page);
  const equipo = 'prueba-maq-01';
  const residenteNuevo = 'ing paz';
  const pk = 'PK 450+60';
  await page.evaluate((id) => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos;
    base.maquinarias.find((maquinaria) => maquinaria.id === id)!.numeroEconomico = 'EXC-001';
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  }, equipo);
  await page.reload();
  const baseAntes = await page.evaluate(
    () => JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos,
  );
  const anterior = baseAntes.combustible.find(
    (fila) => fila.maquinariaId === equipo && fila.fecha === '2026-11-09',
  )!;
  await page.getByLabel('Filtrar por maquinaria').selectOption(equipo);
  await page
    .getByRole('row', { name: /09 nov 2026.*EXC-001/ })
    .getByRole('button', { name: 'Editar registro', exact: true })
    .click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByLabel('PK donde trabaja el residente')).toHaveValue(
    anterior.pkResidente!,
  );
  await dialogo.getByText('Cambiar asignación vigente de la maquinaria', { exact: true }).click();
  const residente = dialogo.getByRole('combobox', { name: 'Ingeniero residente', exact: true });
  await residente.fill(residenteNuevo);
  await expect(dialogo.getByRole('option', { name: /Agregar nuevo:/ })).toBeVisible();
  const ubicacion = dialogo.getByRole('combobox', { name: 'PK / Ubicación', exact: true });
  await ubicacion.fill(pk);
  await expect(dialogo.getByRole('option', { name: /Agregar nuevo:/ })).toHaveCount(1);
  await dialogo.getByLabel('Motivo del cambio *').fill('Formato operativo del PK');
  await confirmarCambios(page);
  await dialogo.getByRole('button', { name: 'Guardar residente y ubicación' }).click();
  await expect(dialogo.getByText(`PK / Ubicación: ${pk}`, { exact: true })).toBeVisible();
  await expect(dialogo.getByLabel('PK donde trabaja el residente')).toHaveValue(
    anterior.pkResidente!,
  );
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.locator('tbody')).toContainText(anterior.nombreResidente!);
  await expect(page.locator('tbody')).toContainText(anterior.pkResidente!);

  await page.reload();
  await page.getByLabel('Filtrar por maquinaria').selectOption(equipo);
  await expect(page.locator('tbody')).toContainText(anterior.pkResidente!);
  await page
    .getByRole('row', { name: /09 nov 2026.*EXC-001/ })
    .getByRole('button', { name: 'Consultar registro', exact: true })
    .click();
  await expect(
    dialogo.getByRole('region', { name: 'Asignación vigente de la maquinaria' }),
  ).toContainText(pk);
  await expect(dialogo.getByRole('region', { name: 'Operación y responsables' })).toContainText(
    anterior.pkResidente!,
  );
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
  const guardada = await page.evaluate(
    () => JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos,
  );
  expect(guardada.horometros).toEqual(baseAntes.horometros);
  expect(guardada.combustible).toEqual(baseAntes.combustible);
  expect(
    guardada.catalogos!.filter(
      (entrada) => entrada.tipo === 'ubicaciones' && clavePk(entrada.nombre) === clavePk(pk),
    ),
  ).toHaveLength(1);
  const periodos = guardada.maquinarias.find(
    (maquinaria) => maquinaria.id === equipo,
  )!.periodosResidentes!;
  expect(periodos.at(-2)).toMatchObject({ fin: periodos.at(-1)!.inicio });
  expect(periodos.at(-1)).toMatchObject({
    nombre: residenteNuevo,
    pk,
    fin: null,
  });
  expect(periodos.at(-1)!.ubicacionId).not.toBe(periodos.at(-2)!.ubicacionId);

  await page.getByRole('button', { name: 'Registrar suministro', exact: true }).click();
  await dialogo.getByLabel('Maquinaria *').selectOption(equipo);
  await dialogo.getByLabel('Hora de carga *').fill('13:00');
  await dialogo.getByText('Datos complementarios del suministro', { exact: true }).click();
  await expect(dialogo.getByLabel('PK donde trabaja el residente')).toHaveValue(pk);
  await dialogo.getByLabel('Litros solicitados *').fill('12');
  await dialogo.getByLabel('Litros cargados *').fill('12');
  await confirmarCambios(page);
  await dialogo.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(dialogo).toHaveCount(0);
  const captura = await page.evaluate((id) => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos;
    return base.combustible.find(
      (registro) => registro.maquinariaId === id && registro.horaCarga === '13:00',
    );
  }, equipo);
  expect(captura).toMatchObject({ pkResidente: pk, ubicacionId: periodos.at(-1)!.ubicacionId });
  await expect(page.locator('tbody')).toContainText(pk);

  await navegar(page, informacion, 'Horómetros');
  await page.getByRole('button', { name: 'Registrar horómetro', exact: true }).click();
  await dialogo.getByLabel('Maquinaria *').selectOption(equipo);
  await expect(dialogo.getByText(/Residente vigente:/)).toContainText(pk);
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await navegar(page, informacion, 'Maquinarias');
  await page.getByLabel('Buscar registros').fill('EXC-001');
  await expect(page.locator('tbody')).toContainText(pk);
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await dialogo.getByRole('tab', { name: 'Responsables' }).click();
  await expect(dialogo).toContainText(pk);
  await expect(dialogo).toContainText('Fecha de asignación del residente');
  await dialogo.getByRole('tab', { name: 'Historial' }).click();
  await dialogo.getByText('Residentes y ubicaciones', { exact: true }).click();
  const historial = dialogo.getByRole('region', { name: 'Historial cronológico de residentes' });
  await expect(historial).toContainText(anterior.pkResidente!);
  await expect(historial).toContainText(pk);
  await expect(historial.getByRole('button')).toHaveCount(0);
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Filtrar por maquinaria').selectOption(equipo);
  await page.getByLabel('Buscar registros').fill(pk);
  await expect(page.getByRole('columnheader', { name: 'Residente / PK', exact: true })).toHaveCount(
    1,
  );
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText(pk);
  await expect(page.locator('tbody')).not.toContainText('PK: PK');
});

test('sincroniza la asignación cambiada desde Maquinarias hacia Combustible y Control Diario', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'));
  await page.goto('/maquinarias');
  await iniciarSesionConMuestraCompleta(page);
  const equipo = 'prueba-maq-01';
  const residente = 'ing paz';
  const pk = 'PK 450+60';
  await page.getByLabel('Buscar registros').fill('EXC-101');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Residente', exact: true }).click();
  const nombre = page.getByRole('combobox', { name: 'Ingeniero residente', exact: true });
  await nombre.fill(residente);
  await page.getByRole('option', { name: `Agregar nuevo: ${residente}` }).click();
  const ubicacion = page.getByRole('combobox', { name: 'PK / Ubicación', exact: true });
  await ubicacion.fill(pk);
  await page.getByRole('option', { name: `Agregar nuevo: ${pk}` }).click();
  await page.getByLabel('Motivo del cambio *').fill('Asignación de residente de prueba');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar residente y ubicación', exact: true }).click();
  await expect(page.locator('tbody')).toContainText(residente);
  await expect(page.locator('tbody')).toContainText(pk);
  const periodo = await page.evaluate((id) => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos;
    return base.maquinarias
      .find((maquinaria) => maquinaria.id === id)!
      .periodosResidentes!.find((asignacion) => asignacion.fin === null);
  }, equipo);
  expect(periodo).toMatchObject({ nombre: residente, pk });
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();

  await navegar(page, informacion, 'Combustible');
  await page.getByRole('button', { name: 'Registrar suministro', exact: true }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Maquinaria *').selectOption(equipo);
  await dialogo.getByLabel('Hora de carga *').fill('13:00');
  await dialogo.getByText('Datos complementarios del suministro', { exact: true }).click();
  await expect(dialogo.getByLabel('Nombre del residente', { exact: true })).toHaveValue(residente);
  await expect(dialogo.getByLabel('PK donde trabaja el residente')).toHaveValue(pk);
  await dialogo.getByLabel('Litros solicitados *').fill('12');
  await dialogo.getByLabel('Litros cargados *').fill('12');
  await confirmarCambios(page);
  await dialogo.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.locator('tbody')).toContainText(residente);
  await expect(page.locator('tbody')).toContainText(pk);

  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Filtrar por maquinaria').selectOption(equipo);
  await page.getByLabel('Buscar registros').fill(pk);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText(residente);
  await page.reload();
  await page.getByLabel('Filtrar por maquinaria').selectOption(equipo);
  await page.getByLabel('Buscar registros').fill(pk);
  await expect(page.locator('tbody')).toContainText(residente);
  await expect(page.locator('tbody')).toContainText(pk);
  const esperaExcel = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
  const excel = await esperaExcel;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(new Uint8Array(await readFile((await excel.path())!)).buffer);
  expect(libro.worksheets[0].columnCount).toBe(11);
  expect(libro.worksheets[0].getCell('E5').value).toBe(`${residente}\n${pk}`);
  const esperaPdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const pdf = await esperaPdf;
  const contenido = (await readFile((await pdf.path())!)).toString('latin1');
  expect(contenido).toContain(residente);
  expect(contenido).toContain(pk);
});
