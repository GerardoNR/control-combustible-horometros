import { Form } from 'react-bootstrap';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { DatosCuenta, Usuario } from '../tipos/usuario';
import { esquemaCuenta, esquemaContrasena } from '../validaciones/usuario';
import { modulosDisponibles } from '../servicios/permisos';
import { Campo, FormularioBase } from '../../../compartido/componentes/FormularioBase';
export function FormularioCuenta({
  cuenta,
  guardar,
  cancelar,
}: {
  cuenta?: Usuario;
  guardar: (datos: DatosCuenta) => Promise<void>;
  cancelar: () => void;
}) {
  const esquema = esquemaCuenta.superRefine((datos, contexto) => {
    if (!cuenta && !esquemaContrasena.safeParse(datos.contrasena).success)
      contexto.addIssue({
        code: 'custom',
        path: ['contrasena'],
        message: 'La nueva cuenta necesita una contraseña válida.',
      });
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<DatosCuenta>({
    resolver: zodResolver(esquema),
    defaultValues: cuenta
      ? { ...cuenta, contrasena: '' }
      : {
          nombre: '',
          nombreUsuario: '',
          contrasena: '',
          rol: 'CAPTURISTA',
          activo: true,
          permisos: [],
        },
  });
  const rol = useWatch({ control, name: 'rol' });
  return (
    <FormularioBase
      cancelar={cancelar}
      enviar={handleSubmit(guardar)}
      etiquetaBoton="Guardar usuario"
    >
      <Campo etiqueta="Nombre completo *" id="nombre" error={errors.nombre}>
        <Form.Control
          {...register('nombre')}
          maxLength={120}
          isInvalid={!!errors.nombre}
          autoComplete="off"
        />
      </Campo>
      <Campo etiqueta="Nombre de usuario *" id="nombreUsuario" error={errors.nombreUsuario}>
        <Form.Control
          {...register('nombreUsuario')}
          maxLength={40}
          isInvalid={!!errors.nombreUsuario}
          autoComplete="off"
        />
      </Campo>
      <Campo
        etiqueta={cuenta ? 'Nueva contraseña (opcional)' : 'Contraseña *'}
        id="contrasena"
        error={errors.contrasena}
        ancho
      >
        <Form.Control
          type="password"
          {...register('contrasena')}
          isInvalid={!!errors.contrasena}
          autoComplete="new-password"
          maxLength={128}
        />
        <Form.Text>
          Solo contraseñas ficticias. Mínimo 10 caracteres con mayúscula, minúscula, número y
          símbolo.{cuenta ? ' Deja vacío para conservar la actual.' : ''}
        </Form.Text>
      </Campo>
      <Campo etiqueta="Rol *" id="rol" error={errors.rol}>
        <Form.Select {...register('rol')}>
          <option value="INVITADO">Invitado</option>
          <option value="CAPTURISTA">Capturista</option>
          <option value="ADMINISTRADOR">Administrador</option>
        </Form.Select>
      </Campo>
      <Campo etiqueta="Estado de la cuenta" id="activo">
        <Form.Check type="switch" label="Cuenta activa" {...register('activo')} />
      </Campo>
      <div style={{ gridColumn: '1 / -1' }}>
        {rol === 'CAPTURISTA' ? (
          <>
            <p className="fw-semibold mb-2">Permisos de registro y edición</p>
            <p className="small text-secondary">
              Puede consultar todos los módulos. Selecciona dónde puede registrar y editar.
            </p>
            <div className="d-flex flex-wrap gap-3">
              {modulosDisponibles.map((modulo) => (
                <Form.Check
                  key={modulo.id}
                  id={`permiso-${modulo.id}`}
                  label={modulo.nombre}
                  value={modulo.id}
                  {...register('permisos')}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="small text-secondary mb-0">
            {rol === 'ADMINISTRADOR'
              ? 'Acceso completo a los cuatro módulos y a la gestión de usuarios.'
              : 'Solo consulta, búsqueda y filtros en los cuatro módulos.'}
          </p>
        )}
      </div>
    </FormularioBase>
  );
}
