import { useState } from 'react';
import { Alert, Badge, Button, Modal, Table } from 'react-bootstrap';
import { useSesion } from '../contextos/contexto-sesion';
import { etiquetasRoles, puedeAdministrar } from '../servicios/permisos';
import type { Usuario, DatosCuenta } from '../tipos/usuario';
import { FormularioCuenta } from '../formularios/FormularioCuenta';
import { Icono } from '../../../compartido/componentes/Icono';
import { mensajeError } from '../../../compartido/utilidades/formato';
import estilos from './Usuarios.module.css';
export function AdministracionUsuarios({ cerrar }: { cerrar: () => void }) {
  const { usuario, listarUsuarios, guardarUsuario } = useSesion();
  const [cuentas, cambiarCuentas] = useState(() => listarUsuarios());
  const [vista, cambiarVista] = useState<'lista' | 'formulario'>('lista');
  const [seleccion, cambiarSeleccion] = useState<Usuario>();
  const [confirmar, cambiarConfirmar] = useState<Usuario>();
  const [error, cambiarError] = useState('');
  const [mensaje, cambiarMensaje] = useState('');
  const [guardando, cambiarGuardando] = useState(false);
  if (!puedeAdministrar(usuario)) return null;
  function actualizar() {
    cambiarError('');
    try {
      cambiarCuentas(listarUsuarios());
    } catch (error: unknown) {
      cambiarError(mensajeError(error));
    }
  }
  async function guardar(datos: DatosCuenta) {
    await guardarUsuario(datos, seleccion?.id);
    cambiarCuentas(listarUsuarios());
    cambiarVista('lista');
    cambiarMensaje(
      seleccion ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.',
    );
  }
  async function cambiarEstado() {
    if (!confirmar || guardando) return;
    cambiarError('');
    cambiarGuardando(true);
    try {
      await guardarUsuario(
        { ...confirmar, contrasena: '', activo: !confirmar.activo },
        confirmar.id,
      );
      cambiarCuentas(listarUsuarios());
      cambiarConfirmar(undefined);
      cambiarMensaje('Estado de la cuenta actualizado.');
    } catch (error: unknown) {
      cambiarError(mensajeError(error));
    } finally {
      cambiarGuardando(false);
    }
  }
  return (
    <Modal
      show
      onHide={guardando ? undefined : cerrar}
      size="lg"
      centered
      backdrop="static"
      aria-labelledby="titulo-usuarios"
    >
      <Modal.Header closeButton={!guardando} closeLabel="Cerrar administración">
        <Modal.Title id="titulo-usuarios">
          {vista === 'lista'
            ? 'Administración de usuarios'
            : seleccion
              ? 'Editar usuario'
              : 'Crear usuario'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        {mensaje && vista === 'lista' && (
          <Alert variant="success" role="status" dismissible onClose={() => cambiarMensaje('')}>
            {mensaje}
          </Alert>
        )}
        {vista === 'formulario' ? (
          <FormularioCuenta
            cuenta={seleccion}
            cancelar={() => cambiarVista('lista')}
            guardar={guardar}
          />
        ) : (
          <>
            {confirmar && (
              <Alert variant="warning">
                <p>
                  ¿{confirmar.activo ? 'Desactivar' : 'Activar'} la cuenta de{' '}
                  <strong>{confirmar.nombre}</strong>?{' '}
                  {confirmar.activo ? 'No podrá iniciar sesión mientras esté inactiva.' : ''}
                </p>
                <div className="d-flex gap-2">
                  <Button
                    variant="light"
                    disabled={guardando}
                    onClick={() => cambiarConfirmar(undefined)}
                  >
                    Cancelar
                  </Button>
                  <Button disabled={guardando} onClick={() => void cambiarEstado()}>
                    {guardando
                      ? 'Guardando…'
                      : confirmar.activo
                        ? 'Confirmar desactivación'
                        : 'Confirmar activación'}
                  </Button>
                </div>
              </Alert>
            )}
            <div className={estilos.herramientas}>
              <span>{cuentas.length} cuentas registradas</span>
              <div className="d-flex gap-2">
                <Button
                  variant="light"
                  disabled={guardando}
                  onClick={actualizar}
                  aria-label="Actualizar usuarios"
                >
                  <Icono nombre="arrow-clockwise" />
                </Button>
                <Button
                  disabled={guardando}
                  onClick={() => {
                    cambiarSeleccion(undefined);
                    cambiarVista('formulario');
                    cambiarError('');
                    cambiarConfirmar(undefined);
                  }}
                >
                  <Icono nombre="person-plus" /> Crear usuario
                </Button>
              </div>
            </div>
            <div
              role="region"
              aria-label="Cuentas de usuario"
              tabIndex={0}
              className={estilos.tabla}
            >
              <Table>
                <thead>
                  <tr>
                    <th>Nombre / usuario</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((cuenta) => (
                    <tr key={cuenta.id}>
                      <td>
                        <strong>{cuenta.nombre}</strong>
                        <small>
                          {cuenta.nombreUsuario}
                          {cuenta.id === usuario?.id ? ' · Tú' : ''}
                        </small>
                      </td>
                      <td>
                        {etiquetasRoles[cuenta.rol]}
                        {cuenta.rol === 'CAPTURISTA' && (
                          <small>{cuenta.permisos.length} módulos con edición</small>
                        )}
                      </td>
                      <td>
                        <Badge bg={cuenta.activo ? 'primary' : 'secondary'}>
                          {cuenta.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button
                            variant="light"
                            size="sm"
                            disabled={guardando}
                            onClick={() => {
                              cambiarSeleccion(cuenta);
                              cambiarVista('formulario');
                              cambiarError('');
                              cambiarConfirmar(undefined);
                            }}
                            aria-label={`Editar a ${cuenta.nombre}`}
                          >
                            <Icono nombre="pencil-square" />
                          </Button>
                          <Button
                            variant="light"
                            size="sm"
                            disabled={guardando || cuenta.id === usuario?.id}
                            title={
                              cuenta.id === usuario?.id
                                ? 'No puedes desactivar tu cuenta'
                                : undefined
                            }
                            onClick={() => {
                              cambiarConfirmar(cuenta);
                              cambiarError('');
                            }}
                            aria-label={`${cuenta.activo ? 'Desactivar' : 'Activar'} a ${cuenta.nombre}`}
                          >
                            <Icono nombre={cuenta.activo ? 'pause-circle' : 'play-circle'} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
