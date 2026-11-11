import { useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import { consolidarControlDiario } from '../../control-diario/servicios/consolidacion';
import { totalizarControl } from '../../control-diario/utilidades/totales-control';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { fechaCorta, hoy, numero } from '../../../compartido/utilidades/formato';
import { SeccionConsulta } from '../../../compartido/componentes/ConsultaRegistro';

export function ActividadMaquinaria({ maquinariaId }: { maquinariaId: string }) {
  const { base } = useDatos();
  const [desde, cambiarDesde] = useState(hoy);
  const [hasta, cambiarHasta] = useState(hoy);
  const invalido = !!desde && !!hasta && desde > hasta;
  const registros = useMemo(
    () =>
      invalido
        ? []
        : consolidarControlDiario(base).filter(
            (registro) =>
              registro.maquinariaId === maquinariaId &&
              (!desde || registro.fecha >= desde) &&
              (!hasta || registro.fecha <= hasta),
          ),
    [base, desde, hasta, invalido, maquinariaId],
  );
  const totales = totalizarControl(registros);
  const periodo =
    desde || hasta
      ? `${desde ? fechaCorta(desde) : 'Sin fecha inicial'} – ${hasta ? fechaCorta(hasta) : 'Sin fecha final'}`
      : 'Todas las fechas';
  return (
    <details className="rounded border p-3 mb-3">
      <summary>Actividad por periodo</summary>
      <div className="row g-3 mt-1 mb-3">
        <Form.Group className="col-sm-6">
          <Form.Label htmlFor="actividad-desde">Desde</Form.Label>
          <Form.Control
            id="actividad-desde"
            type="date"
            value={desde}
            max={hasta || undefined}
            isInvalid={invalido}
            onChange={(evento) => cambiarDesde(evento.target.value)}
          />
        </Form.Group>
        <Form.Group className="col-sm-6">
          <Form.Label htmlFor="actividad-hasta">Hasta</Form.Label>
          <Form.Control
            id="actividad-hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            isInvalid={invalido}
            onChange={(evento) => cambiarHasta(evento.target.value)}
          />
        </Form.Group>
        {invalido && (
          <p role="alert" className="text-danger small mb-0">
            Desde debe ser anterior o igual a Hasta.
          </p>
        )}
      </div>
      <SeccionConsulta
        titulo="Actividad operativa consolidada"
        datos={[
          ['Periodo', periodo],
          ['Días con operaciones', totales.registros],
          ['Horas registradas', `${numero(totales.horas, 2)} h`],
          ['Litros cargados', `${numero(totales.litros, 2)} L`],
          [
            'Rendimiento global',
            totales.litrosHora === null ? 'Pendiente' : `${numero(totales.litrosHora, 3)} L/h`,
          ],
        ]}
      />
      {!invalido && !registros.length && (
        <p className="small text-secondary mb-0">Sin actividad en el periodo seleccionado.</p>
      )}
    </details>
  );
}
