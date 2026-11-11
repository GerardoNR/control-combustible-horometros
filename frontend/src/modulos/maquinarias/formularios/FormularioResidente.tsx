import { IntroduccionFormulario } from './IntroduccionFormulario';
import { SelectorResidente } from '../../../compartido/catalogos/componentes/SelectorResidente';
import { residenteMaquinaria } from '../servicios/responsables';
import { normalizarNombre } from '../../../compartido/catalogos/servicios/catalogos';
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Campo, FormularioBase } from '../../../compartido/componentes/FormularioBase';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { puedeEscribir } from '../../acceso/servicios/permisos';
import estilos from './FormularioMaquinaria.module.css';
import type { Maquinaria } from '../tipos/maquinaria';
import { FormularioOperadorVigente } from './FormularioOperadorVigente';
import { hoy, fechaCalendario } from '../../../compartido/utilidades/formato';
function fechaPosterior(fecha: string) {
  const siguiente = new Date(`${fecha}T12:00:00`);
  siguiente.setDate(siguiente.getDate() + 1);
  return fechaCalendario(siguiente);
}
export function FormularioResidente({
  maquinaria,
  soloResidencia = false,
}: {
  maquinaria: Maquinaria;
  soloResidencia?: boolean;
}) {
  const { base, guardar, usuario } = useDatos();
  const inicial = residenteMaquinaria(base, maquinaria);
  const periodoVigente = maquinaria.periodosResidentes?.find((periodo) => periodo.fin === null);
  const [residente, cambiarResidente] = useState({
    nombre: inicial?.nombre ?? '',
    pk: inicial?.pk ?? '',
  });
  const [motivo, cambiarMotivo] = useState('');
  const [fechaElegida, cambiarFechaAsignacion] = useState<string>();
  const fechaAsignacion = fechaElegida ?? hoy();
  const fechaVigente = periodoVigente && fechaCalendario(new Date(periodoVigente.inicio));
  const [cambiandoOperador, cambiarEstadoOperador] = useState(false);
  if (!puedeEscribir(usuario, 'maquinarias')) return null;
  const cambioResidente =
    normalizarNombre(residente.nombre) !== normalizarNombre(inicial?.nombre ?? '') ||
    residente.pk !== (inicial?.pk ?? '') ||
    (!periodoVigente && !!residente.nombre) ||
    (!!fechaVigente && fechaElegida !== undefined && fechaElegida !== fechaVigente);
  const fechaMinima = fechaVigente
    ? fechaVigente < hoy()
      ? fechaPosterior(fechaVigente)
      : hoy()
    : '2000-01-01';
  return (
    <div className="mt-3">
      <section className="mb-4">
        <IntroduccionFormulario titulo="Residente y ubicación vigentes">
          El residente es el ingeniero responsable del equipo; el operador se administra por
          separado. Los cambios conservan los periodos históricos.
        </IntroduccionFormulario>
        <div className="rounded border bg-light p-3 mb-3">
          <strong>Vigente: {inicial?.nombre || 'Sin residente asignado'}</strong>
          <span className="d-block text-secondary">
            PK / Ubicación: {inicial?.pk || 'Sin ubicación'}
          </span>
          <span className="d-block text-secondary">
            Asignado desde: {fechaVigente ?? 'Sin periodo registrado'}
          </span>
        </div>
        <FormularioBase
          modulo="maquinarias"
          confirmacion={
            cambioResidente
              ? `Asignar ${residente.nombre || 'sin residente'} en ${residente.pk || 'sin ubicación'} desde ${fechaAsignacion}. El historial anterior se conservará.`
              : undefined
          }
          etiquetaBoton="Guardar residente y ubicación"
          cancelar={() => {
            cambiarResidente({ nombre: inicial?.nombre ?? '', pk: inicial?.pk ?? '' });
            cambiarMotivo('');
            cambiarFechaAsignacion(undefined);
          }}
          enviar={async () => {
            if (!cambioResidente)
              throw new Error('No hay cambios de residente, ubicación o fecha para guardar.');
            if (!motivo.trim()) throw new Error('Indica el motivo del cambio.');
            if (!fechaAsignacion || fechaAsignacion < fechaMinima || fechaAsignacion > hoy())
              throw new Error('Selecciona una fecha válida posterior al inicio vigente.');
            const guardada = await guardar(
              'maquinarias',
              { ...maquinaria, motivoCambioResidente: motivo.trim() },
              maquinaria.id,
              { residente, fechaInicioResidente: fechaAsignacion },
            );
            const vigente = guardada.periodosResidentes?.find((periodo) => periodo.fin === null);
            cambiarResidente({ nombre: vigente?.nombre ?? '', pk: vigente?.pk ?? '' });
            cambiarFechaAsignacion(undefined);
            cambiarMotivo('');
          }}
        >
          <div className={estilos.bloqueResidente}>
            <SelectorResidente
              id="nuevoResidente"
              referencia={inicial}
              nombre={residente.nombre}
              pk={residente.pk}
              cambiar={(nombre, pk) => cambiarResidente({ nombre, pk })}
            />
            <Campo id="fechaAsignacionResidente" etiqueta="Fecha de asignación *">
              <Form.Control
                type="date"
                min={fechaMinima}
                max={hoy()}
                value={fechaAsignacion}
                onChange={(evento) => cambiarFechaAsignacion(evento.target.value)}
              />
              <Form.Text>Fecha de inicio del periodo; no se captura hora.</Form.Text>
            </Campo>
            <Campo id="motivoResidente" etiqueta="Motivo del cambio *">
              <Form.Control
                value={motivo}
                maxLength={120}
                placeholder="Ejemplo: cambio de residente o ubicación"
                onChange={(e) => cambiarMotivo(e.target.value)}
              />
            </Campo>
          </div>
        </FormularioBase>
      </section>
      {!soloResidencia && (
        <section className="border-top pt-3">
          <IntroduccionFormulario titulo="Operador vigente">
            Los cambios de operador se registran aquí. Las lecturas y suministros históricos
            mantienen el operador que tenían al capturarse.
          </IntroduccionFormulario>
          {!cambiandoOperador ? (
            <Button variant="outline-primary" onClick={() => cambiarEstadoOperador(true)}>
              {base.asignacionesOperadores?.some(
                (asignacion) => asignacion.maquinariaId === maquinaria.id && !asignacion.fin,
              )
                ? 'Cambiar operador vigente'
                : 'Asignar operador vigente'}
            </Button>
          ) : (
            <FormularioOperadorVigente
              maquinariaId={maquinaria.id}
              cancelar={() => cambiarEstadoOperador(false)}
              exito={() => cambiarEstadoOperador(false)}
            />
          )}
        </section>
      )}
    </div>
  );
}
