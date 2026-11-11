import { useState } from 'react';
import { Alert, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSesion } from '../contextos/contexto-sesion';
import { esquemaAcceso } from '../validaciones/usuario';
import type { DatosAcceso } from '../tipos/usuario';
import { Campo } from '../../../compartido/componentes/FormularioBase';
import { Logotipo } from '../../../compartido/componentes/Logotipo';
import { Icono } from '../../../compartido/componentes/Icono';
import { mensajeError } from '../../../compartido/utilidades/formato';
import estilos from './PaginaAcceso.module.css';
export function PaginaAcceso() {
  const { iniciarSesion } = useSesion();
  const [error, cambiarError] = useState('');
  const [visible, cambiarVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DatosAcceso>({
    resolver: zodResolver(esquemaAcceso),
    defaultValues: { nombreUsuario: '', contrasena: '' },
  });
  const enviar = handleSubmit(async (datos) => {
    cambiarError('');
    try {
      await iniciarSesion(datos);
    } catch (error: unknown) {
      cambiarError(mensajeError(error));
    }
  });
  return (
    <main className={estilos.acceso}>
      <section className={estilos.caja} aria-label="Inicio de sesión">
        <div className={estilos.marca}>
          <Logotipo claro />
        </div>
        <p className={estilos.introduccion}>
          Sistema para registrar y consultar maquinaria, horómetros y combustible
        </p>
        <Form noValidate onSubmit={enviar}>
          <fieldset disabled={isSubmitting}>
            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}
            <Campo etiqueta="Usuario" id="nombreUsuario" error={errors.nombreUsuario}>
              <Form.Control
                {...register('nombreUsuario')}
                autoComplete="username"
                placeholder="Tu usuario"
                isInvalid={!!errors.nombreUsuario}
                aria-describedby={errors.nombreUsuario ? 'nombreUsuario-error' : undefined}
              />
            </Campo>
            <Campo etiqueta="Contraseña" id="contrasena" error={errors.contrasena}>
              <InputGroup className={estilos.campoContrasena}>
                <Form.Control
                  {...register('contrasena')}
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  isInvalid={!!errors.contrasena}
                  aria-describedby={errors.contrasena ? 'contrasena-error' : undefined}
                />
                <Button
                  variant="outline-secondary"
                  className={estilos.botonVisibilidad}
                  onClick={() => cambiarVisible(!visible)}
                  aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={visible}
                >
                  <Icono nombre={visible ? 'eye-slash' : 'eye'} />
                </Button>
              </InputGroup>
            </Campo>
            <Button type="submit" className="w-100 mt-2">
              {isSubmitting ? (
                <Spinner size="sm" aria-label="Iniciando sesión" />
              ) : (
                <Icono nombre="box-arrow-in-right" />
              )}{' '}
              Iniciar sesión
            </Button>
          </fieldset>
        </Form>
      </section>
    </main>
  );
}
