import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { crearMuestraFicticia } from '../../../../pruebas/datos/operaciones-completas';
import { consolidarControlDiario } from './consolidacion';
import { crearReporteControl, encabezadosReporte } from './reporte-control';
import { columnasExcel, indiceExcel } from './reporte-excel';
import { crearExcelControl } from './exportar-excel';
import { filtrosVacios } from '../utilidades/filtros-control';

async function exportar() {
  const base = crearMuestraFicticia('2026-11-09');
  const registro = base.horometros.find((fila) => fila.fecha === '2026-11-09')!;
  base.horometros = [{ ...registro, lecturaInicial: 100, lecturaFinal: 108 }];
  const carga = base.combustible.find((fila) => fila.fecha === '2026-11-09')!;
  base.combustible = [{ ...carga, litrosCargados: 80 }];
  const consolidados = consolidarControlDiario(base);
  const reporte = crearReporteControl(consolidados, filtrosVacios, '', new Date('2026-11-09T18:00:00Z'));
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load((await crearExcelControl(reporte)).buffer as ArrayBuffer);
  return { hoja: libro.worksheets[0], reporte };
}

describe('Formato específico de Excel de Control Diario', () => {
  it('genera una hoja con las 11 columnas en el orden acordado y conserva la captura exacta', async () => {
    const { hoja, reporte } = await exportar();
    expect(hoja.name).toBe('Control Diario');
    expect(hoja.columnCount).toBe(11);
    expect(hoja.getRow(4).values).toEqual([undefined, ...encabezadosReporte]);
    expect(encabezadosReporte).toEqual([
      'Fecha', 'N° económico', 'Maquinaria', 'Operador', 'Residente / PK',
      'Horómetro inicial', 'Horómetro final', 'Horas trabajadas', 'Litros consumidos',
      'Rendimiento (L/h)', 'Alerta',
    ]);
    expect(hoja.rowCount).toBe(6);
    expect(hoja.getCell('A1').value).toBe('Control de Maquinaria - Control Diario');
    expect(hoja.getCell('A2').value).toBe('Generado:');
    expect(hoja.getCell('B2').numFmt).toBe('dd/mm/yyyy');
    expect(String(hoja.getCell('A3').value)).toMatch(/^(Fecha|Periodo):/);
    expect(JSON.stringify(hoja.getRows(1, 4)?.map((fila) => fila.values))).not.toMatch(/Maquinaria: Todas|Búsqueda:|Operador: Todos/);
    expect(hoja.getCell('F5').value).toBe(100);
    expect(hoja.getCell('G5').value).toBe(108);
    expect(hoja.getCell('H5').value).toBe(8);
    expect(hoja.getCell('I5').value).toBe(80);
    expect(hoja.getCell('J5').value).toBe(10);
    expect(hoja.getCell('K5').value).toBe(reporte.registros[0].evaluacion?.nivel);
    expect(hoja.getCell('E5').value).toContain(reporte.registros[0].pkUbicacion);
    expect(hoja.autoFilter).toBe('A4:K5');
    expect(hoja.pageSetup.printArea).toBe('A1:K6');
    expect(hoja.getCell('A4').fill).toMatchObject({ fgColor: { argb: 'FF14263D' } });
    expect(hoja.getCell('A4').font.color?.argb).toBe('FFFFFFFF');
    expect(hoja.getColumn(indiceExcel('residentePk')).width).toBeGreaterThanOrEqual(30);
    expect(hoja.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
    expect(reporte.registros).toHaveLength(1);
  });

  it('alinea el total general y totaliza horas, litros y rendimiento ponderado', async () => {
    const { hoja } = await exportar();
    expect(hoja.getCell('A6').value).toBe('TOTAL GENERAL');
    expect(hoja.model.merges).toContain('A6:G6');
    expect(hoja.getCell('H6').value).toBe(8);
    expect(hoja.getCell('I6').value).toBe(80);
    expect(hoja.getCell('J6').value).toBe(10);
    for (let columna = 1; columna <= columnasExcel.length; columna++)
      expect(hoja.getCell(6, columna).fill).toMatchObject({ fgColor: { argb: 'FFDCEBFF' } });
  });

  it('centraliza los 11 encabezados del PDF y Excel', () => {
    expect(encabezadosReporte).toHaveLength(11);
    expect(columnasExcel.map(({ titulo }) => titulo)).toEqual(encabezadosReporte);
    expect(encabezadosReporte.at(-1)).toBe('Alerta');
    expect(encabezadosReporte).not.toContain('Estado del consumo');
  });

  it('conserva los cuatro estados y colores compartidos de alerta en las celdas', async () => {
    const { reporte } = await exportar();
    const niveles = ['Normal', 'Revisar', 'Crítica', 'Sin evaluar'] as const;
    reporte.registros = niveles.map((nivel, indice) => ({
      ...reporte.registros[0],
      id: `alerta-${indice}`,
      evaluacion: { nivel, motivos: [`Motivo ${nivel}`], rango: '10 a 14 L/h' },
    }));
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load((await crearExcelControl(reporte)).buffer as ArrayBuffer);
    const hoja = libro.worksheets[0];
    const fondos = ['FFE7F4EA', 'FFFFF6DA', 'FFFCE8E8', 'FFFFF1F2'];
    niveles.forEach((nivel, indice) => {
      const celda = hoja.getCell(5 + indice, indiceExcel('alerta'));
      expect(celda.value).toBe(nivel);
      expect(celda.fill).toMatchObject({ fgColor: { argb: fondos[indice] } });
      expect(celda.note).toContain(`Motivo ${nivel}`);
      expect(celda.note).toContain('Rango técnico: 10 a 14 L/h');
    });
  });
});
