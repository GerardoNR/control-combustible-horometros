import { coloresAlerta, detalleAlerta } from './alertas-maquinaria';
import ExcelJS from 'exceljs';
import { fechaGeneracionExcel } from '../utilidades/fechas-reporte';
import type { ReporteControl } from '../tipos/consolidado';
import {
  columnasExcel,
  formatosExcel,
  indiceExcel,
  type ColumnaExcel,
  encabezadosExcel,
  filaCabeceraExcel,
  valoresOperacionExcel,
  valoresTotalesExcel,
} from './reporte-excel';

const azulInstitucional = 'FF14263D';
const bordeDiscreto: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: 'FFD5DEEA' },
};

export async function crearExcelControl(reporte: ReporteControl): Promise<Uint8Array> {
  if (!reporte.registros.length) throw new Error('No hay resultados para exportar.');

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Control de Maquinaria';
  libro.created = reporte.generadoEn;
  const hoja = libro.addWorksheet('Control Diario', {
    views: [{ state: 'frozen', ySplit: filaCabeceraExcel }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${filaCabeceraExcel}:${filaCabeceraExcel}`,
    },
    headerFooter: { oddFooter: 'Página &P de &N' },
  });
  hoja.columns = columnasExcel.map((columna) => ({ width: columna.ancho }));
  const celdaDe = (fila: ExcelJS.Row, clave: ColumnaExcel) => fila.getCell(indiceExcel(clave));

  hoja.mergeCells(1, 1, 1, columnasExcel.length);
  const titulo = hoja.getCell('A1');
  titulo.value = 'Control de Maquinaria - Control Diario';
  titulo.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: azulInstitucional },
  };
  titulo.alignment = { vertical: 'middle', indent: 1 };
  hoja.getRow(1).height = 27;

  hoja.getCell('A2').value = 'Generado:';
  hoja.getCell('B2').value = fechaGeneracionExcel(reporte.generadoEn);
  hoja.getCell('B2').numFmt = 'dd/mm/yyyy';
  hoja.getCell('A3').value = reporte.periodo;
  for (const numeroFila of [2, 3]) {
    const fila = hoja.getRow(numeroFila);
    fila.height = 19;
    fila.eachCell((celda) => {
      celda.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
      celda.alignment = { vertical: 'middle', wrapText: false };
    });
  }
  hoja.getCell('A2').font = { name: 'Calibri', size: 10, bold: true, color: { argb: azulInstitucional } };
  hoja.getCell('A3').font = { name: 'Calibri', size: 10, bold: true, color: { argb: azulInstitucional } };

  function aplicarEstiloFila(fila: ExcelJS.Row, tipo: 'encabezado' | 'normal' | 'alternada' | 'total') {
    for (const { clave } of columnasExcel) {
      const celda = celdaDe(fila, clave);
      const formato = formatosExcel[clave];
      if (formato && tipo !== 'encabezado') celda.numFmt = formato;
      const encabezado = tipo === 'encabezado';
      const total = tipo === 'total';
      celda.font = {
        name: 'Calibri',
        size: 10,
        bold: encabezado || total,
        color: { argb: encabezado ? 'FFFFFFFF' : total ? azulInstitucional : 'FF334155' },
      };
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: encabezado
            ? azulInstitucional
            : total
              ? 'FFDCEBFF'
              : tipo === 'alternada'
                ? 'FFF3F7FC'
                : 'FFFFFFFF',
        },
      };
      celda.border = {
        top: bordeDiscreto,
        bottom: bordeDiscreto,
        left: bordeDiscreto,
        right: bordeDiscreto,
      };
      celda.alignment = {
        vertical: 'middle',
        horizontal: formato && clave !== 'fecha' ? 'right' : 'left',
        wrapText: true,
        indent: 1,
      };
    }
  }

  const encabezado = hoja.getRow(filaCabeceraExcel);
  encabezado.values = encabezadosExcel;
  encabezado.height = 31;
  aplicarEstiloFila(encabezado, 'encabezado');
  celdaDe(encabezado, 'alerta').note = 'Evaluación calculada con las mismas reglas de Control Diario.';

  reporte.registros.forEach((registro, indice) => {
    const valores = valoresOperacionExcel(registro).map((valor) =>
      valor === null ? 'Sin registrar' : valor,
    );
    const fila = hoja.addRow(valores);
    celdaDe(fila, 'fecha').value = new Date(`${registro.fecha}T00:00:00.000Z`);
    if ((registro.lecturasHorometro?.length ?? 0) > 1)
      celdaDe(fila, 'horas').note = registro
        .lecturasHorometro!.map((lectura) => `${lectura.inicial} a ${lectura.final} h`)
        .join('\n');
    const lineas = Math.max(
      ...valores.map((valor, columna) =>
        String(valor)
          .split('\n')
          .reduce(
            (total, texto) =>
              total + Math.max(1, Math.ceil(texto.length / Math.max(8, columnasExcel[columna].ancho - 4))),
            0,
          ),
      ),
    );
    fila.height = Math.min(38, Math.max(20, lineas * 12 + 4));
    aplicarEstiloFila(fila, indice % 2 ? 'alternada' : 'normal');

    const alerta = detalleAlerta(registro);
    const notas = alerta.rango ? [...alerta.motivos, alerta.rango] : alerta.motivos;
    if (notas.length) celdaDe(fila, 'alerta').note = notas.join('\n');
    const tono = coloresAlerta[alerta.nivel];
    celdaDe(fila, 'alerta').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${tono.fondo.slice(1)}` },
    };
    celdaDe(fila, 'alerta').font = {
      name: 'Calibri',
      size: 10,
      color: { argb: `FF${tono.texto.slice(1)}` },
    };
  });

  const ultimaFilaDatos = filaCabeceraExcel + reporte.registros.length;
  hoja.autoFilter = {
    from: { row: filaCabeceraExcel, column: 1 },
    to: { row: ultimaFilaDatos, column: columnasExcel.length },
  };
  const filaTotal = hoja.addRow(
    valoresTotalesExcel(reporte).map((valor) => (valor === null ? 'Sin registrar' : valor)),
  );
  hoja.mergeCells(filaTotal.number, 1, filaTotal.number, indiceExcel('horas') - 1);
  aplicarEstiloFila(filaTotal, 'total');
  filaTotal.height = 22;
  filaTotal.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  hoja.pageSetup.printArea = `A1:${hoja.getCell(hoja.rowCount, columnasExcel.length).address}`;

  return new Uint8Array(await libro.xlsx.writeBuffer());
}
