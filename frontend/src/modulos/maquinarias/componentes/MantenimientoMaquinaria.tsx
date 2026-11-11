import { ProgressBar } from 'react-bootstrap';
import { LineaTiempo } from './LineaTiempo';
import { fechaVisible } from '../utilidades/fecha-historial';
import { fechaCorta, numero } from '../../../compartido/utilidades/formato';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { serviciosMaquinaria, type ResumenMantenimiento } from '../servicios/mantenimiento';
import type { Maquinaria } from '../tipos/maquinaria';
import estilos from './MantenimientoMaquinaria.module.css';

const colores = {
  verde: { etiqueta: 'Verde · En rango', variante: 'success' },
  amarillo: { etiqueta: 'Amarillo · Próximo', variante: 'warning' },
  rojo: { etiqueta: 'Rojo · Vencido', variante: 'danger' },
  secundario: { etiqueta: '', variante: 'secondary' },
};

function mostrarHoras(valor: number | null, pendiente = 'Sin datos') {
  return valor === null ? pendiente : `${numero(valor, 20)} h`;
}

export function LecturaHorometro({ valor }: { valor: number | null }) {
  return <>{mostrarHoras(valor, 'Revisar horómetro')}</>;
}

function Semaforo({ resumen }: { resumen: ResumenMantenimiento }) {
  return (
    <span className={`${estilos.etiqueta} ${estilos[resumen.tono]}`}>
      {colores[resumen.tono].etiqueta || resumen.estado}
    </span>
  );
}

export function UltimoMantenimiento({ resumen }: { resumen: ResumenMantenimiento }) {
  const { servicio, inicioIntervalo } = resumen;
  if (!servicio) return <small className="text-secondary">Sin servicio registrado</small>;
  return (
    <div className={estilos.celda}>
      <small>
        {fechaCorta(servicio.fecha)} · {servicio.tipoServicio}
      </small>
      <small>Horómetro del servicio: {mostrarHoras(inicioIntervalo)}</small>
    </div>
  );
}

export function ProximoMantenimiento({ resumen }: { resumen: ResumenMantenimiento }) {
  const { objetivo, limite, limiteRestante, horas, excedidas, motivoRevision } = resumen;
  return (
    <div className={estilos.celda}>
      {objetivo !== null && <small>Objetivo: {mostrarHoras(objetivo)}</small>}
      {horas !== null && (
        <>
          <small>Trabajadas desde el servicio: {mostrarHoras(horas)}</small>
          <small>
            Límite ({limite} h):{' '}
            {excedidas
              ? `Vencido por ${mostrarHoras(excedidas)}`
              : `${mostrarHoras(limiteRestante)} restantes`}
          </small>
        </>
      )}
      {motivoRevision && <small className="text-secondary">{motivoRevision}</small>}
      <Semaforo resumen={resumen} />
    </div>
  );
}

export function FichaMantenimiento({ resumen }: { resumen: ResumenMantenimiento }) {
  const {
    servicio,
    inicioIntervalo,
    actual,
    aviso,
    limite,
    objetivoAviso,
    objetivo,
    horas,
    avisoRestante,
    limiteRestante,
    excedidas,
    progreso,
    motivoRevision,
  } = resumen;
  return (
    <section aria-label="Estado del mantenimiento" className="mb-3">
      <h3 className="h6 mb-2">Mantenimiento</h3>
      <div className="row g-2">
        <section aria-label="Último servicio" className="col-12 col-sm-4">
          <div className="border rounded p-3 h-100">
            <h4 className="h6">Último servicio</h4>
            <dl className={estilos.datos}>
              <div>
                <dt>Fecha</dt>
                <dd>{servicio ? fechaCorta(servicio.fecha) : 'Sin registrar'}</dd>
              </div>
              <div>
                <dt>Tipo de mantenimiento</dt>
                <dd>{servicio?.tipoServicio ?? 'Sin registrar'}</dd>
              </div>
              <div>
                <dt>Horómetro del servicio</dt>
                <dd>{mostrarHoras(inicioIntervalo)}</dd>
              </div>
            </dl>
          </div>
        </section>
        <section aria-label="Próximo servicio" className="col-12 col-sm-8">
          <div className="border rounded p-3 h-100">
            <h4 className="h6">Próximo servicio</h4>
            <Semaforo resumen={resumen} />
            {motivoRevision && <p className="small text-secondary mt-2 mb-0">{motivoRevision}</p>}
            {resumen.tono === 'amarillo' && (
              <p className="small mb-0 mt-1">Programa o realiza el servicio.</p>
            )}
            <dl className={`${estilos.datos} ${estilos.datosProximo}`}>
              <div>
                <dt>Horómetro actual</dt>
                <dd>
                  <LecturaHorometro valor={actual} />
                </dd>
              </div>
              <div>
                <dt>Horas acumuladas</dt>
                <dd>{mostrarHoras(horas)}</dd>
              </div>
              <div>
                <dt>Horómetro de aviso ({aviso} h)</dt>
                <dd>{mostrarHoras(objetivoAviso)}</dd>
              </div>
              <div>
                <dt>Horómetro límite ({limite} h)</dt>
                <dd>{mostrarHoras(objetivo)}</dd>
              </div>
              <div>
                <dt>Faltan para el aviso</dt>
                <dd>{mostrarHoras(avisoRestante)}</dd>
              </div>
              <div>
                <dt>Faltan para el límite</dt>
                <dd>
                  {mostrarHoras(limiteRestante)}
                  {excedidas ? ` · Vencido por ${mostrarHoras(excedidas)}` : ''}
                </dd>
              </div>
            </dl>
            {progreso !== null && (
              <ProgressBar
                now={progreso}
                variant={colores[resumen.tono].variante}
                className={estilos.progreso}
                aria-label={`Progreso de mantenimiento: ${mostrarHoras(horas)} de ${mostrarHoras(limite)}`}
              />
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export function DetallesMantenimiento({ equipo }: { equipo: Maquinaria }) {
  const { base } = useDatos();
  const servicios = serviciosMaquinaria(base, equipo.id);
  return (
    <>
      <LineaTiempo
        etiqueta="Historial de mantenimientos"
        vacio="Sin movimientos registrados"
        eventos={servicios.map((servicio) => ({
          id: servicio.id,
          titulo: servicio.tipoServicio,
          periodo: fechaVisible(servicio.fecha),
          datos: [
            ['Horómetro del servicio', `${numero(servicio.lecturaHorometro, 3)} h`],
            ['Usuario responsable', servicio.creadoPor],
            ['Observaciones', servicio.observaciones || 'Sin observaciones registradas'],
          ],
        }))}
      />
      {(equipo.fechaUltimoMantenimiento || equipo.observacionesMantenimiento) &&
        !servicios.some(
          (servicio) =>
            servicio.fecha === equipo.fechaUltimoMantenimiento &&
            servicio.observaciones === equipo.observacionesMantenimiento,
        ) && (
          <details className="mt-3">
            <summary>Datos de mantenimiento anteriores</summary>
            <dl className="mt-2 mb-0">
              <dt>Fecha registrada</dt>
              <dd>
                {equipo.fechaUltimoMantenimiento
                  ? fechaVisible(equipo.fechaUltimoMantenimiento)
                  : 'Sin fecha registrada'}
              </dd>
              <dt>Observaciones</dt>
              <dd>{equipo.observacionesMantenimiento || 'Sin observaciones registradas'}</dd>
            </dl>
          </details>
        )}
    </>
  );
}
