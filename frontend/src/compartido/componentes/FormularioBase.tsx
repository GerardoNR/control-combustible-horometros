import { useSesion } from '../../modulos/acceso/contextos/contexto-sesion';
import { puedeEscribir } from '../../modulos/acceso/servicios/permisos';
import type { Modulo } from '../tipos/datos';
import { useId, useState } from 'react';
import type { ReactNode, FormEventHandler } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import type { FieldError } from 'react-hook-form';
import { mensajeError } from '../utilidades/formato';
import { Icono } from './Icono';
import estilos from './Interfaz.module.css';
export function FormularioBase({
  modulo,
  etiquetaBoton = 'Guardar registro',
  children,
  enviar,
  cancelar,
  confirmacion,
}: {
  confirmacion?: string;
  modulo?: Modulo;
  etiquetaBoton?: string;
  children: ReactNode;
  enviar: () => Promise<void>;
  cancelar: () => void;
}) {
  const idConfirmacion = useId();
  const { usuario } = useSesion();
  const autorizado = !modulo || puedeEscribir(usuario, modulo);
  const [guardando, cambiarGuardando] = useState(false);
  const [error, cambiarError] = useState('');
  const [confirmado, cambiarConfirmado] = useState<string>();
  const manejarEnvio: FormEventHandler<HTMLFormElement> = (evento) => {
    evento.preventDefault();
    if (guardando || !autorizado) return;
    if (confirmacion && confirmado !== confirmacion) {
      cambiarError('Confirma el cambio de responsables o ubicación antes de guardar.');
      return;
    }
    cambiarGuardando(true);
    cambiarError('');
    void enviar()
      .catch((error) => cambiarError(mensajeError(error)))
      .finally(() => cambiarGuardando(false));
  };
  if (!autorizado)
    return <Alert variant="info">Tu usuario tiene acceso de consulta a este módulo.</Alert>;
  return (
    <Form noValidate onSubmit={manejarEnvio}>
      <fieldset disabled={guardando}>
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        <div className={estilos.campos}>{children}</div>
        {confirmacion && (
          <Alert variant="warning" role="note" className="mt-3 mb-0">
            <p className="mb-2">{confirmacion}</p>
            <Form.Check
              id={idConfirmacion}
              label="Confirmo el cambio y conservo el historial anterior"
              checked={confirmado === confirmacion}
              onChange={(evento) =>
                cambiarConfirmado(evento.target.checked ? confirmacion : undefined)
              }
            />
          </Alert>
        )}
        <div className={estilos.pieFormulario}>
          <span>
            <Icono nombre="shield-check" /> Cambios con trazabilidad
          </span>
          <div className="d-flex gap-2">
            <Button variant="light" onClick={cancelar}>
              Cancelar
            </Button>
            <Button type="submit">
              {guardando ? <Spinner size="sm" aria-label="Guardando" /> : <Icono nombre="check2" />}{' '}
              {etiquetaBoton}
            </Button>
          </div>
        </div>
      </fieldset>
    </Form>
  );
}
export function Campo({
  etiqueta,
  id,
  error,
  ancho,
  children,
}: {
  etiqueta: string;
  id: string;
  error?: FieldError;
  ancho?: boolean;
  children: ReactNode;
}) {
  return (
    <Form.Group controlId={id} className={ancho ? estilos.anchoCompleto : ''}>
      <Form.Label>{etiqueta}</Form.Label>
      {children}
      {error && (
        <div className="invalid-feedback d-block" id={`${id}-error`}>
          {error.message}
        </div>
      )}
    </Form.Group>
  );
}
