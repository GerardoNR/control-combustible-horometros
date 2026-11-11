import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Button, Form, Badge, Alert, Collapse } from 'react-bootstrap';
import type { ReactNode } from 'react';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { Icono } from '../../../compartido/componentes/Icono';
import { serviciosMaquinaria } from '../servicios/mantenimiento';
import {
  fechaLocal,
  fechaVisible,
  fechaDelInstante,
  validarFechaConsulta,
  periodosDelDia,
} from '../utilidades/fecha-historial';
import { LineaTiempo } from './LineaTiempo';
import { HistorialMaquinaria } from './HistorialMaquinaria';
import { DetallesMantenimiento } from './MantenimientoMaquinaria';
import type { Maquinaria } from '../tipos/maquinaria';
import estilos from './HistorialConsultaMaquinaria.module.css';
function Apartado({
  titulo,
  icono,
  cantidad,
  children,
}: {
  titulo: string;
  icono: string;
  cantidad: number;
  children: ReactNode;
}) {
  const id = useId();
  const [abierto, cambiarAbierto] = useState(false);
  const duracion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160;
  return (
    <div className={estilos.apartado} data-apartado-historial>
      <h3 className={estilos.tituloApartado}>
        <Button
          id={`${id}-titulo`}
          variant="link"
          className={estilos.botonApartado}
          aria-expanded={abierto}
          aria-controls={`${id}-contenido`}
          onClick={() => cambiarAbierto(!abierto)}
        >
          <Icono nombre={icono} />
          <span>{titulo}</span>
          <Badge pill bg="light" text="dark" aria-label={`${cantidad} registros`}>
            {cantidad}
          </Badge>
          <span className={estilos.flecha} aria-hidden="true">
            {abierto ? '−' : '+'}
          </span>
        </Button>
      </h3>
      <Collapse in={abierto} timeout={duracion} mountOnEnter={false} unmountOnExit={false}>
        <div id={`${id}-contenido`} role="region" aria-labelledby={`${id}-titulo`}>
          <div className={estilos.contenido}>{children}</div>
        </div>
      </Collapse>
    </div>
  );
}
export function HistorialConsultaMaquinaria({ registro }: { registro: Maquinaria }) {
  const { base } = useDatos();
  const contenido = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nodo = contenido.current;
    const ventana = nodo?.closest<HTMLElement>('.modal-dialog');
    const panel = nodo?.closest<HTMLElement>('[role="tabpanel"]');
    const cabecera = ventana?.querySelector<HTMLElement>('.modal-header');
    const pestanas = ventana?.querySelector<HTMLElement>('[role="tablist"]');
    if (!nodo || !ventana || !panel || !cabecera || !pestanas) return;
    const ajustarAltura = () => {
      if (!panel.classList.contains('active')) return;
      const estilo = getComputedStyle(panel!);
      const altura = Math.ceil(
        nodo.getBoundingClientRect().height +
          cabecera.getBoundingClientRect().height +
          pestanas.getBoundingClientRect().height +
          parseFloat(estilo.paddingTop) +
          parseFloat(estilo.paddingBottom) +
          2,
      );
      ventana.style.setProperty('--altura-historial', `${altura}px`);
    };
    // Medir solo la presentación; no modificar datos ni otras pestañas.
    const observador = new ResizeObserver(ajustarAltura);
    [nodo, cabecera, pestanas].forEach((elemento) => observador.observe(elemento));
    window.addEventListener('resize', ajustarAltura);
    ajustarAltura();
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', ajustarAltura);
      ventana.style.removeProperty('--altura-historial');
    };
  }, []);
  const [consulta, cambiarConsulta] = useState(fechaLocal);
  const [limite, cambiarLimite] = useState(fechaLocal);
  const [error, cambiarError] = useState('');
  const operadores = [...(base.asignacionesOperadores ?? [])]
    .filter((p) => p.maquinariaId === registro.id)
    .sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio));
  const residentes = [...(registro.periodosResidentes ?? [])].sort(
    (a, b) => Date.parse(b.inicio) - Date.parse(a.inicio),
  );
  const operadoresDelDia = periodosDelDia(operadores, consulta);
  const residentesDelDia = periodosDelDia(residentes, consulta);
  const servicios = serviciosMaquinaria(base, registro.id);
  const modificaciones = registro.historial.length;
  const creacionRegistrada = registro.historial.some(
    (cambio) => cambio.fecha === registro.creadoEn && cambio.usuarioNombre === registro.creadoPor,
  );
  const modificacionRegistrada = registro.historial.some(
    (cambio) =>
      cambio.fecha === registro.modificadoEn && cambio.usuarioNombre === registro.modificadoPor,
  );
  function seleccionar(valor: string) {
    const ahora = new Date();
    cambiarLimite(fechaLocal(ahora));
    try {
      cambiarConsulta(validarFechaConsulta(valor, ahora));
      cambiarError('');
    } catch (error) {
      cambiarError(error instanceof Error ? error.message : 'Selecciona una fecha válida.');
    }
  }
  return (
    <section
      ref={contenido}
      className={estilos.historial}
      aria-label="Historial de responsables y modificaciones"
    >
      <div className={estilos.filtro}>
        <Form.Group controlId="consultaHistorialFecha">
          <Form.Label>Consultar historial por fecha</Form.Label>
          <div className={estilos.controlesFecha}>
            <div className={estilos.selectorFecha}>
              <Form.Control
                type="date"
                lang="es-MX"
                max={limite}
                value={consulta}
                onFocus={() => cambiarLimite(fechaLocal())}
                onChange={(e) => seleccionar(e.target.value)}
                aria-invalid={!!error}
                isInvalid={!!error}
              />
              <time dateTime={consulta} aria-hidden="true">
                {fechaVisible(consulta)}
              </time>
            </div>
            <Button
              size="sm"
              variant="outline-primary"
              onClick={() => {
                const hoy = fechaLocal();
                cambiarConsulta(hoy);
                cambiarLimite(hoy);
                cambiarError('');
              }}
            >
              Hoy
            </Button>
          </div>
        </Form.Group>
      </div>
      {error && (
        <Alert variant="warning" role="alert" className="py-2 mb-2">
          {error}
        </Alert>
      )}
      <div
        className={estilos.resumen}
        role="status"
        aria-label="Responsables en la fecha seleccionada"
      >
        <section aria-label="Operador de la fecha">
          <h4>Operador de la fecha</h4>
          {operadoresDelDia.length ? (
            <ol className={estilos.nombres} data-varios={operadoresDelDia.length > 1}>
              {operadoresDelDia.map((periodo) => (
                <li key={periodo.id}>
                  <strong>{periodo.operador}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p>Sin asignación registrada</p>
          )}
        </section>
        <section
          className={estilos.residentesFecha}
          aria-label="Residentes y ubicaciones de la fecha"
        >
          <div className={estilos.etiquetasResidente}>
            <h4>Residente responsable</h4>
            <h4>PK / Ubicación</h4>
          </div>
          {residentesDelDia.length ? (
            <ol className={estilos.nombres} data-varios={residentesDelDia.length > 1}>
              {residentesDelDia.map((periodo) => (
                <li key={periodo.id}>
                  <div className={estilos.residencia}>
                    <strong>{periodo.nombre}</strong>
                    <span>{periodo.pk || 'Sin PK registrado'}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className={estilos.residencia}>
              <p>Sin asignación registrada</p>
              <p>Sin asignación registrada</p>
            </div>
          )}
        </section>
      </div>
      <Apartado titulo="Operadores" icono="person-gear" cantidad={operadores.length}>
        <LineaTiempo
          vacio="Sin movimientos registrados"
          etiqueta="Historial cronológico de operadores"
          eventos={operadores.map((p) => ({
            id: p.id,
            titulo: `${fechaDelInstante(p.inicio)} — ${p.operador}`,
            periodo: `Desde: ${fechaDelInstante(p.inicio)} · Hasta: ${p.fin ? fechaDelInstante(p.fin) : 'Vigente'}`,
            estado: p.fin ? 'Finalizado' : 'Vigente',
            datos: [
              ['Maquinaria', registro.numeroEconomico],
              ['Motivo de asignación', p.motivo],
              ['Usuario responsable', p.usuarioResponsableNombre],
              ...(p.cierre
                ? ([
                    ['Motivo de finalización', p.cierre.motivo],
                    ['Cerrado por', p.cierre.usuarioResponsableNombre],
                  ] as [string, string][])
                : []),
            ],
          }))}
        />
      </Apartado>
      <Apartado titulo="Residentes y ubicaciones" icono="geo-alt" cantidad={residentes.length}>
        <LineaTiempo
          vacio="Sin movimientos registrados"
          etiqueta="Historial cronológico de residentes"
          eventos={residentes.map((p) => ({
            id: p.id,
            titulo: p.nombre,
            periodo: `${fechaDelInstante(p.inicio)} → ${p.fin ? fechaDelInstante(p.fin) : 'Actualidad'}`,
            estado: p.fin ? 'Finalizado' : 'Vigente',
            datos: [
              ['PK / Ubicación', <strong>{p.pk || 'Sin registrar'}</strong>],
              ['Motivo de asignación', p.motivo],
              ['Usuario responsable', p.usuarioNombre],
              ...(p.cierre
                ? ([
                    ['Motivo de finalización', p.cierre.motivo],
                    ['Cerrado por', p.cierre.usuarioNombre],
                  ] as [string, string][])
                : []),
            ],
          }))}
        />
      </Apartado>
      <Apartado titulo="Mantenimientos" icono="tools" cantidad={servicios.length}>
        <DetallesMantenimiento equipo={registro} />
      </Apartado>
      <Apartado titulo="Modificaciones" icono="clock-history" cantidad={modificaciones}>
        {(!creacionRegistrada || !modificacionRegistrada) && (
          <p className={estilos.metadatos}>
            {!creacionRegistrada && (
              <span className="d-block">
                Creado por <strong>{registro.creadoPor}</strong> ·{' '}
                {fechaDelInstante(registro.creadoEn)}
              </span>
            )}
            {!modificacionRegistrada && (
              <span className="d-block">
                Última modificación por <strong>{registro.modificadoPor}</strong> ·{' '}
                {fechaDelInstante(registro.modificadoEn)}
              </span>
            )}
          </p>
        )}
        <HistorialMaquinaria maquinaria={registro} recientesPrimero soloFechas />
      </Apartado>
    </section>
  );
}
