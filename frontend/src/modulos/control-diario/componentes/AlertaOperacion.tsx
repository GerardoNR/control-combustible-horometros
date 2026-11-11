import { useState } from 'react';
import { Badge, Button, Modal } from 'react-bootstrap';
import { coloresAlerta, detalleAlerta, recomendacionAlerta } from '../servicios/alertas-maquinaria';
import type { OperacionConsolidada } from '../tipos/consolidado';
import { fechaCorta, numero } from '../../../compartido/utilidades/formato';
import estilos from './IndicadorEstado.module.css';

export function AlertaOperacion({ registro }: { registro: OperacionConsolidada }) {
  const [mostrar, cambiarMostrar] = useState(false);
  const alerta = detalleAlerta(registro);
  const color = coloresAlerta[alerta.nivel];
  const lecturas = registro.lecturasHorometro ?? [];
  const horas = registro.horas === null ? 'Sin registrar' : `${numero(registro.horas, 2)} h`;
  const litros = registro.litros === null ? 'Sin registrar' : `${numero(registro.litros, 2)} L`;
  const rendimiento =
    registro.litrosHora === null ? 'Sin registrar' : `${numero(registro.litrosHora, 3)} L/h`;

  return (
    <>
      <Button
        type="button"
        variant="link"
        className={estilos.boton}
        aria-haspopup="dialog"
        aria-label={`Consultar alerta ${alerta.nivel} de ${registro.numeroEconomico}`}
        onClick={() => cambiarMostrar(true)}
      >
        <Badge
          bg=""
          className={estilos.indicador}
          style={{ backgroundColor: color.fondo, color: color.texto }}
        >
          {alerta.nivel}
        </Badge>
      </Button>
      <Modal show={mostrar} onHide={() => cambiarMostrar(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Consulta de alerta</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <section className="mb-3" aria-label="Información de maquinaria">
            <h6 className="text-primary">Información de la maquinaria</h6>
            <dl className="row mb-0 small">
              <dt className="col-5">N° económico</dt>
              <dd className="col-7">{registro.numeroEconomico}</dd>
              <dt className="col-5">Maquinaria</dt>
              <dd className="col-7">{registro.maquinaria}</dd>
              <dt className="col-5">Fecha</dt>
              <dd className="col-7">{fechaCorta(registro.fecha)}</dd>
            </dl>
          </section>
          <section className="mb-3" aria-label="Datos registrados">
            <h6 className="text-primary">Datos registrados</h6>
            <dl className="row mb-0 small">
              <dt className="col-7">Horas trabajadas</dt>
              <dd className="col-5">{horas}</dd>
              <dt className="col-7">Litros cargados</dt>
              <dd className="col-5">{litros}</dd>
              <dt className="col-7">Rendimiento real</dt>
              <dd className="col-5">{rendimiento}</dd>
              {alerta.rango && (
                <>
                  <dt className="col-7">Consumo técnico esperado</dt>
                  <dd className="col-5">{alerta.rango.replace('Rango técnico: ', '')}</dd>
                </>
              )}
              {lecturas.length > 0 && (
                <>
                  <dt className="col-7">Horómetro inicial / final</dt>
                  <dd className="col-5">
                    {numero(lecturas[0].inicial, 2)} / {numero(lecturas.at(-1)!.final, 2)}
                  </dd>
                </>
              )}
            </dl>
          </section>
          <section aria-label="Resultado de la evaluación">
            <h6 className="text-primary">Resultado</h6>
            <p>
              <Badge bg="" style={{ backgroundColor: color.fondo, color: color.texto }}>
                {alerta.nivel}
              </Badge>
            </p>
            <p className="mb-1">{recomendacionAlerta(registro)}</p>
            {alerta.nivel !== 'Normal' &&
              alerta.nivel !== 'Crítica' &&
              alerta.motivos.length > 0 && (
                <p className="small text-secondary mb-0">{alerta.motivos.slice(0, 2).join('. ')}</p>
              )}
          </section>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => cambiarMostrar(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
