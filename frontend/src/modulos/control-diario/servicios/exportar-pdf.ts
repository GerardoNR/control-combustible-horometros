import { coloresAlerta } from './alertas-maquinaria';
import { fechaGeneracion } from '../utilidades/fechas-reporte';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { ReporteControl } from '../tipos/consolidado';
import {
  columnasReporte,
  type ColumnaReporte,
  valoresOperacion,
  valoresTotales,
} from './reporte-control';
import { numero } from '../../../compartido/utilidades/formato';

export function crearPdfControl(reporte: ReporteControl) {
  if (!reporte.registros.length) throw new Error('No hay resultados para exportar.');
  const documento = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const margen = 10;
  const anchoPagina = documento.internal.pageSize.getWidth();
  const anchoTabla = anchoPagina - 2 * margen;
  const bordeDerecho = anchoPagina - margen;

  documento.setProperties({
    title: 'Control de Maquinaria - Control Diario',
    author: 'Control de Maquinaria',
    subject: reporte.periodo,
  });

  function cabecera() {
    documento.setFillColor('#14263D');
    documento.rect(0, 0, anchoPagina, 22, 'F');
    documento.setFont('helvetica', 'bold');
    documento.setFontSize(14);
    documento.setTextColor('#FFFFFF');
    documento.text('Control de Maquinaria', margen, 9);
    documento.setFontSize(11);
    documento.text('Control Diario', margen, 17);
    documento.setFont('helvetica', 'normal');
    documento.setFontSize(8);
    documento.setTextColor('#334155');
    documento.text(`Generado: ${fechaGeneracion(reporte.generadoEn)}`, margen, 29);
    documento.text(reporte.periodo, bordeDerecho, 29, { align: 'right' });
  }

  cabecera();
  const decimales: Partial<Record<ColumnaReporte, number>> = {
    horometroInicial: 2,
    horometroFinal: 2,
    horas: 2,
    litros: 2,
    rendimiento: 3,
  };
  function formatear(valor: string | number | null | undefined, clave: ColumnaReporte) {
    if (valor === null || valor === undefined) return 'Sin registrar';
    return typeof valor === 'number' ? numero(valor, decimales[clave]) : valor;
  }

  const anchos = [15, 17, 22, 28, 45, 18, 18, 17, 18, 21, 27];
  const anchoTotal = anchos.reduce((total, ancho) => total + ancho, 0);
  const estilosColumnas = Object.fromEntries(
    columnasReporte.map(({ clave }, indice) => [
      clave,
      {
        cellWidth: (anchos[indice] / anchoTotal) * anchoTabla,
        halign: clave in decimales ? ('right' as const) : ('left' as const),
      },
    ]),
  );
  const totales: Partial<Record<ColumnaReporte, number | null>> = valoresTotales(reporte);
  const primeraColumnaTotal = columnasReporte.findIndex(({ clave }) => clave === 'horas');

  autoTable(documento, {
    startY: 35,
    margin: { left: margen, right: margen, top: 35, bottom: 13 },
    tableWidth: anchoTabla,
    columns: columnasReporte.map(({ clave, titulo }) => ({ dataKey: clave, header: titulo })),
    body: reporte.registros.map((registro) => {
      const valores = valoresOperacion(registro);
      return Object.fromEntries(
        columnasReporte.map(({ clave }) => [clave, formatear(valores[clave], clave)]),
      );
    }),
    foot: [
      [
        { content: 'TOTAL GENERAL', colSpan: primeraColumnaTotal },
        ...columnasReporte.slice(primeraColumnaTotal).map(({ clave }) => ({
          content:
            totales[clave] === null || totales[clave] === undefined
              ? ''
              : formatear(totales[clave], clave),
          styles: { halign: clave in decimales ? ('right' as const) : ('left' as const) },
        })),
      ],
    ],
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 1.35,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: '#D5DEEA',
      lineWidth: 0.1,
    },
    headStyles: { fillColor: '#14263D', textColor: '#FFFFFF', fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: '#E8EEF7', textColor: '#14263D', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: '#F4F7FB' },
    columnStyles: estilosColumnas,
    didParseCell: (datos) => {
      if (datos.section !== 'body' || datos.column.dataKey !== 'alerta') return;
      const nivel = reporte.registros[datos.row.index].evaluacion?.nivel ?? 'Sin evaluar';
      const tono = coloresAlerta[nivel];
      datos.cell.styles.fillColor = tono.fondo;
      datos.cell.styles.textColor = tono.texto;
      datos.cell.styles.fontStyle = 'bold';
    },
    didDrawPage: cabecera,
  });

  const paginas = documento.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    documento.setPage(pagina);
    documento.setFont('helvetica', 'normal');
    documento.setFontSize(8);
    documento.setTextColor('#526176');
    documento.text(
      `${pagina} / ${paginas}`,
      bordeDerecho,
      documento.internal.pageSize.getHeight() - 6,
      { align: 'right' },
    );
  }
  return documento;
}
