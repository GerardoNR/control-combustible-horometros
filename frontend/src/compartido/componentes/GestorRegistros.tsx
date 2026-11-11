import { EstadoMaquinaria } from './DatosEquipo';
import estilosConsulta from './ModalConsulta.module.css';
import { useDatos } from '../contextos/contexto-datos';
import { mensajeError } from '../utilidades/formato';
import { useSesion } from '../../modulos/acceso/contextos/contexto-sesion';
import { puedeEscribir } from '../../modulos/acceso/servicios/permisos';
import { fechaHora } from '../utilidades/formato';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import type { Auditoria, Modulo } from '../tipos/datos';
import { TablaRegistros } from './TablaRegistros';
import type { Columna } from './TablaRegistros';
import { HistorialRegistro } from './HistorialRegistro';
import { Icono } from './Icono';
import estilos from './Interfaz.module.css';
interface Propiedades<Registro extends Auditoria> {
  modulo: Modulo;
  titulo: string;
  singular: string;
  registros: Registro[];
  columnas: Columna<Registro>[];
  filtros: ReactNode;
  formulario?: (registro: Registro | undefined, cerrar: () => void, exito: () => void) => ReactNode;
  herramientas?: ReactNode;
  contenidoConsulta?: (registro: Registro) => ReactNode;
  detallesConsulta?: (registro: Registro) => ReactNode;
  sinMaquinaria?: boolean;
}
export function GestorRegistros<Registro extends Auditoria>({
  modulo,
  titulo,
  singular,
  registros,
  columnas,
  filtros,
  formulario,
  herramientas,
  detallesConsulta,
  contenidoConsulta,
  sinMaquinaria,
}: Propiedades<Registro>) {
  const { usuario } = useSesion();
  const { eliminar, base } = useDatos();
  const [eliminando, cambiarEliminando] = useState(false);
  const [errorEliminar, cambiarErrorEliminar] = useState('');
  const soloConsulta = modulo === 'control-diario';
  const editable = !soloConsulta && puedeEscribir(usuario, modulo);
  const [modal, cambiarModal] = useState<
    'nuevo' | 'editar' | 'consulta' | 'historial' | 'eliminar' | null
  >(null);
  const [seleccionInicial, cambiarSeleccion] = useState<Registro>();
  const seleccion = seleccionInicial
    ? (base[modulo].find((registro) => registro.id === seleccionInicial.id) as Registro | undefined)
    : undefined;
  const esConsulta = modal === 'consulta';
  const maquinariaConsulta = seleccion
    ? base.maquinarias.find(
        (maquinaria) =>
          maquinaria.id ===
          (modulo === 'maquinarias' ? seleccion.id : Reflect.get(seleccion, 'maquinariaId')),
      )
    : undefined;
  const [confirmacion, cambiarConfirmacion] = useState('');
  const cerrar = () => cambiarModal(null);
  const abrir = (tipo: 'editar' | 'consulta' | 'historial', registro: Registro) => {
    if (soloConsulta || (tipo === 'editar' && !editable)) return;
    cambiarSeleccion(registro);
    cambiarModal(tipo);
  };
  async function confirmarEliminacion() {
    if (
      !seleccion ||
      !editable ||
      eliminando ||
      (modulo !== 'horometros' && modulo !== 'combustible')
    )
      return;
    cambiarEliminando(true);
    cambiarErrorEliminar('');
    try {
      await eliminar(modulo, seleccion.id);
      cerrar();
      cambiarConfirmacion('Registro eliminado. Control Diario se actualizó automáticamente.');
    } catch (error: unknown) {
      cambiarErrorEliminar(mensajeError(error));
    } finally {
      cambiarEliminando(false);
    }
  }
  return (
    <section className={estilos.panel} aria-label={titulo}>
      {confirmacion && (
        <Alert
          variant="success"
          dismissible
          onClose={() => cambiarConfirmacion('')}
          className="m-3"
          role="status"
        >
          <Icono nombre="check-circle" /> {confirmacion}
        </Alert>
      )}
      <div className={estilos.cabeceraPanel}>
        <div>
          <h2>
            {titulo}
          </h2>
          <p>
            {editable
              ? 'Consulta y administra tus registros'
              : soloConsulta
                ? 'Consulta y reportes · actualización automática'
                : 'Consulta los registros · acceso de lectura'}
          </p>
        </div>
        {editable && (
          <Button
            onClick={() => {
              cambiarSeleccion(undefined);
              cambiarModal('nuevo');
            }}
            disabled={sinMaquinaria}
          >
            <Icono nombre="plus-lg" /> Registrar {singular}
          </Button>
        )}
      </div>
      {sinMaquinaria && editable && (
        <Alert variant="info" className="mx-4">
          Registra una maquinaria antes de continuar.
        </Alert>
      )}
      {herramientas}
      <div className={estilos.filtros}>{filtros}</div>
      <TablaRegistros
        mostrarAcciones={!soloConsulta}
        mostrarHistorial={false}
        eliminar={
          editable && (modulo === 'horometros' || modulo === 'combustible')
            ? (registro) => {
                cambiarSeleccion(registro);
                cambiarErrorEliminar('');
                cambiarModal('eliminar');
              }
            : undefined
        }
        editable={editable}
        registros={registros}
        columnas={columnas}
        editar={(registro) => abrir('editar', registro)}
        consultar={(registro) => abrir('consulta', registro)}
        historial={(registro) => abrir('historial', registro)}
      />
      <Modal
        show={
          !soloConsulta &&
          modal !== null &&
          (editable || (modal !== 'nuevo' && modal !== 'editar' && modal !== 'eliminar'))
        }
        onHide={eliminando ? undefined : cerrar}
        aria-labelledby="titulo-registro"
        size={esConsulta ? 'xl' : 'lg'}
        dialogClassName={esConsulta ? estilosConsulta.dialogo : undefined}
        scrollable={esConsulta}
        keyboard={!eliminando}
        centered
        backdrop="static"
      >
        <Modal.Header
          className={esConsulta ? estilosConsulta.encabezado : undefined}
          closeButton={!esConsulta && !eliminando}
          closeLabel="Cerrar"
        >
          <div className={esConsulta ? estilosConsulta.identidad : undefined}>
            <Modal.Title id="titulo-registro">
              {modal === 'nuevo'
                ? 'Registrar'
                : modal === 'editar'
                  ? 'Editar'
                  : modal === 'consulta'
                    ? 'Consultar'
                    : modal === 'eliminar'
                      ? 'Eliminar'
                      : 'Historial de'}{' '}
              {singular}
            </Modal.Title>
            {esConsulta && maquinariaConsulta && (
              <div className={estilosConsulta.resumen}>
                <strong>{maquinariaConsulta.numeroEconomico}</strong>
                <span>{maquinariaConsulta.tipo}</span>
                <EstadoMaquinaria estado={maquinariaConsulta.estado} />
              </div>
            )}
          </div>
          {esConsulta && (
            <Button
              variant="outline-secondary"
              className={estilosConsulta.cerrar}
              onClick={cerrar}
              aria-label="Cerrar"
            >
              <Icono nombre="x-lg" /> Cerrar
            </Button>
          )}
        </Modal.Header>
        <Modal.Body
          tabIndex={esConsulta && modulo !== 'maquinarias' ? 0 : undefined}
          className={
            esConsulta
              ? `${estilosConsulta.cuerpo} ${modulo === 'maquinarias' ? estilosConsulta.conPestanas : ''}`
              : undefined
          }
        >
          {modal !== 'nuevo' && !seleccion && (
            <Alert variant="info">
              El registro ya no está disponible con los filtros actuales. Cierra esta ventana para
              consultar los datos actualizados.
            </Alert>
          )}
          {modal === 'eliminar' && editable && seleccion && (
            <>
              <Alert variant="warning">
                ¿Eliminar este registro de {singular}? Control Diario se recalculará. Se conservará
                el historial de la eliminación.
              </Alert>
              {errorEliminar && (
                <Alert variant="danger" role="alert">
                  {errorEliminar}
                </Alert>
              )}
              <div className="d-flex justify-content-end gap-2">
                <Button variant="light" disabled={eliminando} onClick={cerrar}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  disabled={eliminando}
                  onClick={() => void confirmarEliminacion()}
                >
                  {eliminando ? 'Eliminando…' : 'Confirmar eliminación'}
                </Button>
              </div>
            </>
          )}

          {editable &&
            (modal === 'nuevo' || (modal === 'editar' && seleccion)) &&
            formulario?.(seleccion, cerrar, () => {
              cerrar();
              cambiarConfirmacion(
                modal === 'nuevo'
                  ? 'Registro creado correctamente.'
                  : 'Cambios guardados correctamente.',
              );
            })}
          {modal === 'consulta' &&
            seleccion &&
            (contenidoConsulta ? (
              contenidoConsulta(seleccion)
            ) : (
              <>
                <dl className={estilos.consulta}>
                  {columnas.map((columna) => (
                    <div key={columna.titulo}>
                      <dt>{columna.titulo}</dt>
                      <dd>{columna.mostrar(seleccion)}</dd>
                    </div>
                  ))}
                </dl>
                {detallesConsulta?.(seleccion)}
                <p className="small text-secondary mt-4">
                  Creado por <strong>{seleccion.creadoPor}</strong> ·{' '}
                  {fechaHora(seleccion.creadoEn)}
                  <br />
                  Modificado por <strong>{seleccion.modificadoPor}</strong> ·{' '}
                  {fechaHora(seleccion.modificadoEn)}
                </p>
                <Button variant="outline-primary" onClick={() => cambiarModal('historial')}>
                  <Icono nombre="clock-history" /> Ver historial completo
                </Button>
              </>
            ))}
          {modal === 'historial' && seleccion && <HistorialRegistro registro={seleccion} />}
        </Modal.Body>
      </Modal>
    </section>
  );
}
