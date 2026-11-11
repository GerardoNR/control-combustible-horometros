import {
  valoresOperacionExcel,
  encabezadosExcel,
} from '../src/modulos/control-diario/servicios/reporte-excel';
import { numero } from '../src/compartido/utilidades/formato';
import { fechaReporte } from '../src/modulos/control-diario/servicios/reporte-control';
import { iniciarSesionConMuestraCompleta, navegar } from './ayudantes';
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { consolidarControlDiario } from '../src/modulos/control-diario/servicios/consolidacion';
import {
  filtrarControlDiario,
  filtrosVacios,
} from '../src/modulos/control-diario/utilidades/filtros-control';
import { totalizarControl } from '../src/modulos/control-diario/utilidades/totales-control';
import type { BaseDatos } from '../src/compartido/tipos/datos';

const ejecutar = promisify(execFile);
test.use({ timezoneId: 'America/Monterrey' });
test('configura consumo, conserva residentes históricos y exporta una sola tabla en varias páginas', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'));
  await page.goto('/maquinarias');
  await iniciarSesionConMuestraCompleta(page);
  await page.getByLabel('Buscar registros').fill('EXC-101');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('tab', { name: 'Consumo', exact: true }).click();
  await expect(modal.getByLabel('Máximo normal (L/h) *')).toHaveValue('14');
  await modal.getByLabel('Máximo normal (L/h) *').fill('12');
  await modal.getByLabel('Máximo de advertencia (L/h) *').fill('15');
  await modal
    .getByLabel('Referencia operativa validada *')
    .fill('Rangos ficticios para pruebas; no son valores técnicos oficiales.');
  await modal.getByLabel('Validado por *').fill('Responsable ficticio de pruebas');
  await modal.getByRole('button', { name: 'Guardar límites de consumo', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  const tablaDiaria = page.getByRole('region', {
    name: 'Tabla de registros, desplazable horizontalmente',
  });
  await expect(tablaDiaria.locator('tbody tr')).toHaveCount(1);
  await expect(tablaDiaria.locator('tbody')).toContainText('Medio');
  const encabezadosDiarios = [
    'Fecha', 'N° económico', 'Maquinaria', 'Operador', 'Residente / PK', 'Horas',
    'Litros', 'Rendimiento (L/h)', 'Alerta', 'Estado del consumo',
  ];
  await expect(tablaDiaria.getByRole('columnheader')).toHaveText(encabezadosDiarios);
  await expect(tablaDiaria.locator('tbody tr').first().locator('td').nth(4)).toContainText('PK:');
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    const lectura = base.horometros.find(
      (r: { maquinariaId: string }) => r.maquinariaId === 'prueba-maq-01',
    );
    const carga = base.combustible.find(
      (r: { maquinariaId: string }) => r.maquinariaId === 'prueba-maq-01',
    );
    const equipo = base.maquinarias[0];
    const [anterior, vigente] = equipo.periodosResidentes;
    equipo.periodosResidentes = [
      {
        ...anterior,
        nombre: 'Residente anterior ficticio',
        inicio: '2026-10-10T00:00:00-06:00',
        fin: '2026-11-04T12:00:00-06:00',
        cierre: { ...anterior.cierre, registradoEn: '2026-11-04T12:00:00-06:00' },
      },
      { ...vigente, nombre: 'Residente vigente ficticio', inicio: '2026-11-04T12:00:00-06:00' },
    ];
    base.horometros = [];
    base.combustible = [];
    for (let indice = 0; indice < 35; indice++) {
      const fecha = new Date(Date.UTC(2026, 9, 6 + indice)).toISOString().slice(0, 10);
      const periodo = base.asignacionesOperadores.find(
        (r: { maquinariaId: string; inicio: string; fin: string | null }) =>
          r.maquinariaId === equipo.id &&
          Date.parse(r.inicio) <= Date.parse(`${fecha}T08:00:00-06:00`) &&
          (!r.fin || Date.parse(r.fin) > Date.parse(`${fecha}T08:00:00-06:00`)),
      );
      const responsable = {
        operador: periodo.operador,
        operadorId: periodo.operadorId,
        asignacionId: periodo.id,
      };
      base.horometros.push({
        ...lectura,
        ...responsable,
        id: `prueba-reporte-h-${indice}`,
        fecha,
        fechaAsignacion: periodo.inicio.slice(0, 10),
        lecturaInicial: 2400 + indice * 10,
        lecturaFinal: 2404 + indice * 10,
      });
      base.horometros.push({
        ...base.horometros.at(-1),
        id: `prueba-reporte-h-${indice}-segundo`,
        lecturaInicial: 2406 + indice * 10,
        lecturaFinal: 2410 + indice * 10,
      });
      const litros = indice === 0 ? 80 : indice === 34 ? 160 : 100;
      for (const turno of [0, 1])
        base.combustible.push({
          ...carga,
          ...responsable,
          id: `prueba-reporte-c-${indice}-${turno}`,
          fecha,
          horaCarga: turno ? '14:30' : '08:30',
          litrosSolicitados: litros / 2,
          litrosCargados: litros / 2,
        });
    }
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  await page.getByLabel('Fecha desde', { exact: true }).fill('2026-10-06');
  const base = (await page.evaluate(() =>
    JSON.parse(localStorage.getItem('marimba.datos.v1')!),
  )) as BaseDatos;
  const todas = consolidarControlDiario(base);
  expect(todas).toHaveLength(35);
  expect(new Set(todas.map((r) => r.estadoConsumo))).toEqual(new Set(['Bueno', 'Medio', 'Malo']));
  await expect(page.getByRole('region', { name: 'Resumen filtrado' })).toContainText(
    '35 registros filtrados',
  );
  await page.getByLabel('Página siguiente').click();
  const rutas: string[] = [];
  async function descargar(filas: typeof todas, nombre: string) {
    const esperaExcel = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
    const excel = await esperaExcel;
    const rutaExcel = informacion.outputPath(`${nombre}.xlsx`);
    await excel.saveAs(rutaExcel);
    rutas.push(rutaExcel);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(new Uint8Array(await readFile(rutaExcel)).buffer);
    expect(libro.worksheets.map((hoja) => hoja.name)).toEqual(['Control Diario']);
    const hoja = libro.worksheets[0];
    expect(hoja.rowCount).toBe(5 + filas.length);
    expect(hoja.getRow(4).values).toEqual([undefined, ...encabezadosExcel]);
    expect(hoja.columnCount).toBe(11);
    for (const [indice, fila] of filas.entries()) {
      const datos = hoja.getRow(5 + indice);
      const esperados = valoresOperacionExcel(fila);
      expect((datos.getCell(1).value as Date).toISOString().slice(0, 10)).toBe(fila.fecha);
      for (let columna = 2; columna <= 11; columna++)
        expect(datos.getCell(columna).value).toBe(esperados[columna - 1] ?? 'Sin registrar');
    }
    expect(hoja.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
    expect(hoja.autoFilter).toBeDefined();
    const totales = totalizarControl(filas);
    expect(hoja.getCell(`H${hoja.rowCount}`).value).toBe(totales.horas);
    expect(hoja.getCell(`I${hoja.rowCount}`).value).toBe(totales.litros);
    expect(hoja.getCell(`J${hoja.rowCount}`).value).toBe(totales.litrosHora);
    const esperaPdf = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
    const pdf = await esperaPdf;
    const rutaPdf = informacion.outputPath(`${nombre}.pdf`);
    await pdf.saveAs(rutaPdf);
    rutas.push(rutaPdf);
    const bytes = await readFile(rutaPdf);
    expect((bytes.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    const { stdout: texto } = await ejecutar('pdftotext', ['-layout', rutaPdf, '-']);
    expect(texto).not.toContain('Totales por maquinaria');
    const textoCompacto = texto.replace(/\s+/g, ' ');
    const repeticionesEncabezado = texto.match(/Horómetro/g)?.length ?? 0;
    expect(repeticionesEncabezado).toBeGreaterThanOrEqual(2);
    expect(repeticionesEncabezado % 2).toBe(0);
    expect(textoCompacto).toContain('inicial final');
    expect(texto.match(/TOTAL GENERAL/g)).toHaveLength(1);
    expect(
      texto
        .split('\n')
        .find((linea) => linea.includes('TOTAL GENERAL'))
        ?.trim()
        .split(/\s+/),
    ).toEqual([
      'TOTAL',
      'GENERAL',
      numero(totales.horas, 2),
      numero(totales.litros, 2),
      numero(totales.litrosHora!, 3),
    ]);
    expect(texto.match(/Control de Maquinaria/g)!.length).toBeGreaterThan(1);
    expect(texto).not.toContain('Estado del consumo');
    const { stdout: textoSecuencial } = await ejecutar('pdftotext', ['-raw', rutaPdf, '-']);
    const bloques = textoSecuencial.split(/(?=\d{2}\/\d{2}\/\d{4} EXC-101)/);
    for (const fila of filas) {
      const bloque = bloques.find((texto) =>
        texto.startsWith(`${fechaReporte(fila.fecha)} ${fila.numeroEconomico} `),
      );
      expect(bloque?.replace(/\s+/g, ' ')).toContain(fila.evaluacion?.nivel ?? 'Sin evaluar');
      const linea = texto
        .split('\n')
        .find(
          (linea) => linea.includes(fechaReporte(fila.fecha)) && linea.includes(fila.numeroEconomico),
        );
      expect(linea).toBeDefined();
      expect(linea).toContain(`${numero(fila.horas!, 2)}`);
      expect(linea).toContain(`${numero(fila.litros!, 2)}`);
      expect(linea).toContain(`${numero(fila.litrosHora!, 3)}`);
      expect(texto).toContain(fila.numeroEconomico);
      for (const residente of fila.residente.split('\n'))
        expect(texto).toContain(residente.split(' (')[0]);
      for (const pk of fila.pkUbicacion.split('\n')) expect(texto).toContain(pk);
    }
  }
  await descargar(todas, 'reporte-completo');
  await page.getByLabel('Fecha desde', { exact: true }).fill('2026-10-10');
  await page.getByLabel('Fecha hasta', { exact: true }).fill('2026-11-04');
  await page.getByLabel('Filtrar por operador').fill('Ernesto');
  const filtradas = filtrarControlDiario(todas, {
    ...filtrosVacios,
    maquinaria: 'prueba-maq-01',
    operador: 'Ernesto',
    desde: '2026-10-10',
    hasta: '2026-11-04',
  });
  await descargar(filtradas, 'reporte-filtrado');
  await page.screenshot({ path: informacion.outputPath('consumo-filtrado.png'), fullPage: true });
  await page.getByLabel('Buscar registros').fill('Sin resultados');
  let vacios = 0;
  page.on('download', () => vacios++);
  for (const tipo of ['Excel', 'PDF']) {
    await page.getByRole('button', { name: `Exportar ${tipo}`, exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('No hay resultados');
  }
  expect(vacios).toBe(0);
  expect(rutas).toHaveLength(4);
});
