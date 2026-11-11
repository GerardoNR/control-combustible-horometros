import { useState } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { Icono } from '../../../compartido/componentes/Icono';
import { mensajeError } from '../../../compartido/utilidades/formato';
import { descargarArchivo } from '../utilidades/descargar';
import type { FiltrosControl, OperacionConsolidada } from '../tipos/consolidado';
import type { IndicadorMaquinaria } from '../tipos/indicadores-maquinaria';
import { crearReporteControl } from '../servicios/reporte-control';
export function ExportacionesControl({
  registros,
  filtros,
  maquinaria,
  indicadores,
  umbralHorasDiarias,
}: {
  registros: OperacionConsolidada[];
  filtros: FiltrosControl;
  maquinaria: string;
  indicadores: IndicadorMaquinaria[];
  umbralHorasDiarias?: number;
}) {
  const [exportando, cambiarExportando] = useState<'excel' | 'pdf' | null>(null);
  const [mensaje, cambiarMensaje] = useState('');
  const [error, cambiarError] = useState('');
  const consultaActual = JSON.stringify([filtros, registros.length]);
  const [consultaMensaje, cambiarConsultaMensaje] = useState('');
  async function exportar(tipo: 'excel' | 'pdf') {
    if (exportando) return;
    cambiarConsultaMensaje(consultaActual);
    cambiarError('');
    cambiarMensaje('');
    if (!registros.length) {
      cambiarError(
        'No hay resultados que cumplan los filtros. Ajusta los filtros antes de exportar.',
      );
      return;
    }
    cambiarExportando(tipo);
    try {
      const reporte = crearReporteControl(
        registros,
        filtros,
        maquinaria,
        new Date(),
        indicadores,
        umbralHorasDiarias,
      );
      const nombre = `Control de Maquinaria-Control-Diario-${reporte.generadoEn.toISOString().replace(/[:.]/g, '-')}`;
      if (tipo === 'excel') {
        const { crearExcelControl } = await import('../servicios/exportar-excel');
        descargarArchivo(
          await crearExcelControl(reporte),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          `${nombre}.xlsx`,
        );
      } else {
        const { crearPdfControl } = await import('../servicios/exportar-pdf');
        descargarArchivo(
          new Uint8Array(crearPdfControl(reporte).output('arraybuffer')),
          'application/pdf',
          `${nombre}.pdf`,
        );
      }
      cambiarMensaje(
        `Descarga preparada: ${reporte.registros.length} registros filtrados. Revisa las descargas de tu navegador.`,
      );
    } catch (error: unknown) {
      cambiarError(`No se pudo preparar la descarga. ${mensajeError(error)}`);
    } finally {
      cambiarExportando(null);
    }
  }
  return (
    <div className="px-4 pb-3">
      <div className="d-flex flex-wrap gap-2">
        <Button
          variant="outline-primary"
          disabled={exportando !== null}
          onClick={() => void exportar('excel')}
        >
          {exportando === 'excel' ? <Spinner size="sm" /> : <Icono nombre="file-earmark-excel" />}{' '}
          Exportar Excel
        </Button>
        <Button
          variant="outline-primary"
          disabled={exportando !== null}
          onClick={() => void exportar('pdf')}
        >
          {exportando === 'pdf' ? <Spinner size="sm" /> : <Icono nombre="file-earmark-pdf" />}{' '}
          Exportar PDF
        </Button>
        <span className="small text-secondary align-self-center">
          Todos los resultados filtrados, en todas las páginas.
        </span>
      </div>
      {mensaje && consultaMensaje === consultaActual && (
        <Alert
          variant="success"
          role="status"
          className="mt-3 mb-0"
          dismissible
          onClose={() => cambiarMensaje('')}
        >
          {mensaje}
        </Alert>
      )}
      {error && consultaMensaje === consultaActual && (
        <Alert
          variant="danger"
          role="alert"
          className="mt-3 mb-0"
          dismissible
          onClose={() => cambiarError('')}
        >
          {error}
        </Alert>
      )}
    </div>
  );
}
