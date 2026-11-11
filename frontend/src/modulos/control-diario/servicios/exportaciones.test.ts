import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { consolidarControlDiario } from './consolidacion';
import { crearReporteControl } from './reporte-control';
import { indiceExcel } from './reporte-excel';
import { crearExcelControl } from './exportar-excel';
import { crearPdfControl } from './exportar-pdf';
import { filtrosVacios, filtrarControlDiario } from '../utilidades/filtros-control';
import { crearIndicadoresMaquinaria } from './indicadores-maquinaria';
function reportePrueba(cantidad = 12) {
  const base = crearDemostracion();
  const lectura = base.horometros[0],
    carga = base.combustible[0],
    manual = base['control-diario'][0];
  const fechas = Array.from(
    { length: cantidad },
    (_, indice) =>
      `2026-${String(Math.floor(indice / 28) + 1).padStart(2, '0')}-${String((indice % 28) + 1).padStart(2, '0')}`,
  );
  base.horometros = fechas.map((fecha, indice) => ({
    ...lectura,
    id: `h-${indice}`,
    fecha,
    fechaAsignacion: fecha,
    actividad: `Frente ${String(indice + 1).padStart(2, '0')}`,
  }));
  base.combustible = fechas.map((fecha, indice) => ({
    ...carga,
    id: `c-${indice}`,
    fecha,
    litrosCargados: 80,
  }));
  base['control-diario'] = fechas.map((fecha, indice) => ({
    ...manual,
    id: `m-${indice}`,
    fecha,
    actividad: `Frente ${String(indice + 1).padStart(2, '0')}`,
  }));
  const filtros = {
    ...filtrosVacios,
    desde: '2026-01-03',
    maquinaria: 'maq-1',
    operador: 'jose',
    busqueda: 'EXC-001',
  };
  const registros = filtrarControlDiario(consolidarControlDiario(base), filtros);
  return crearReporteControl(
    registros,
    filtros,
    'EXC-001',
    new Date('2026-11-06T18:00:00Z'),
    crearIndicadoresMaquinaria(base, registros, filtros),
  );
}
describe('Reportes filtrados', () => {
  it('genera un XLSX con todos los filtrados, fechas reales, números, filtros y totales', async () => {
    const reporte = reportePrueba();
    expect(reporte.registros).toHaveLength(10);
    const bytes = await crearExcelControl(reporte);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(bytes.buffer as ArrayBuffer);
    const hoja = libro.getWorksheet('Control Diario')!;
    expect(hoja.getCell('A1').value).toContain('Control de Maquinaria');
    expect(hoja.getCell('E2').value).toBeNull();
    expect(hoja.getCell('A3').value).toContain('03/01/2026');
    expect(hoja.getCell('A5').value).toBeInstanceOf(Date);
    expect(hoja.getCell('A5').numFmt).toBe('dd/mm/yyyy');
    expect(hoja.getCell('H5').value).toBe(8);
    expect(hoja.getCell('I5').value).toBe(80);
    expect(hoja.getCell('J5').value).toBe(10);
    expect(hoja.getCell('H14').value).toBe(8);
    expect(hoja.getCell('C4').value).toBe('Maquinaria');
    expect(hoja.columnCount).toBe(11);
    expect(hoja.getCell('D5').value).toBe(reporte.registros[0].operador);
    expect(hoja.getCell('H15').value).toBe(80);
    expect(hoja.getCell('I15').value).toBe(800);
    expect(hoja.autoFilter).toBeDefined();
    expect(libro.worksheets.map((hoja) => hoja.name)).toEqual(['Control Diario']);
    expect(hoja.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
    expect(hoja.getCell(5, indiceExcel('alerta')).value).toBe('Revisar');
    expect(hoja.getRow(4).values).toHaveLength(12);
    expect(hoja.getCell('E5').value).toBe('Sin registrar');
  });
  it('genera PDF con todos los filtrados y totales, y pagina tablas extensas', () => {
    const reporte = reportePrueba(60);
    const mensajes = vi.spyOn(console, 'log');
    const documento = (() => {
      try {
        const pdf = crearPdfControl(reporte);
        expect(mensajes).not.toHaveBeenCalledWith(expect.stringContaining('width could not fit'));
        return pdf;
      } finally {
        mensajes.mockRestore();
      }
    })();
    expect(documento.getNumberOfPages()).toBeGreaterThan(1);
    const texto = documento.output();
    expect(texto).toContain('Control de Maquinaria');
    expect(texto).toContain('Maquinaria');
    expect(texto).not.toContain('Frente');
    expect(texto).not.toContain('Actividad');
    expect(texto).toContain('03/01/2026');
    expect(texto).toContain('04/03/2026');
    expect(texto).toContain('TOTAL');
    expect(texto).not.toContain('Totales por maquinaria');
    expect(texto).not.toContain('jose');
    expect(texto).not.toContain('Búsqueda');
  });
  it('sin filtros incluye todos los registros y totaliza por sumas', async () => {
    const base = crearDemostracion();
    const filas = consolidarControlDiario(base);
    const reporte = crearReporteControl(
      filtrarControlDiario(filas, filtrosVacios),
      filtrosVacios,
      '',
    );
    expect(reporte.registros).toHaveLength(filas.length);
    expect(reporte.totales.horas).toBe(filas.reduce((total, fila) => total + (fila.horas ?? 0), 0));
    expect(reporte.totales.litrosHora).toBe(reporte.totales.litros / reporte.totales.horas);
    const bytes = await crearExcelControl(reporte);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(bytes.buffer as ArrayBuffer);
    expect(libro.getWorksheet('Control Diario')?.getCell(`H${5 + filas.length}`).value).toBe(
      reporte.totales.horas,
    );
  });
  it('exporta fuentes parciales sin inventar rendimientos y conserva el cociente de pares válidos', async () => {
    const fila = reportePrueba().registros[0];
    const registros = [
      { ...fila, horas: 2, litros: 80, litrosHora: 40, horasLitro: 0.025 },
      { ...fila, id: 'segundo', horas: 8, litros: 20, litrosHora: 2.5, horasLitro: 0.4 },
      {
        ...fila,
        id: 'parcial',
        horas: null,
        litros: 900,
        litrosHora: null,
        horasLitro: null,
        pendientes: ['Falta horómetro'],
      },
    ];
    const reporte = crearReporteControl(registros, filtrosVacios, '');
    expect(reporte.totales.litrosHora).toBe(10);
    const libro = new ExcelJS.Workbook();
    const bytes = await crearExcelControl(reporte);
    await libro.xlsx.load(bytes.buffer as ArrayBuffer);
    const hoja = libro.getWorksheet('Control Diario')!;
    expect(hoja.getCell('H7').value).toBe('Sin registrar');
    expect(hoja.getCell('J7').value).toBe('Sin registrar');
    expect(hoja.getCell('J8').value).toBe(10);
    const pdf = crearPdfControl(reporte).output();
    expect(pdf).not.toContain('NaN');
    expect(pdf).not.toContain('Infinity');
  });
  it('rechaza reportes vacíos y toma una instantánea que no cambia al editar las fuentes', () => {
    expect(() => crearReporteControl([], filtrosVacios, '')).toThrow('No hay resultados');
    const reporte = reportePrueba();
    const valor = reporte.registros[0].horas;
    const clon = crearReporteControl(reporte.registros, filtrosVacios, '');
    reporte.registros[0].horas = 20;
    expect(clon.registros[0].horas).toBe(valor);
  });
});
