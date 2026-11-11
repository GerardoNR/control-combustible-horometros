import { Dropdown } from 'react-bootstrap';
import { useSesion } from '../contextos/contexto-sesion';
import { etiquetasRoles } from '../servicios/permisos';
import { Icono } from '../../../compartido/componentes/Icono';
import estilos from '../../../aplicacion/Aplicacion.module.css';

export function MenuPerfil() {
  const { usuario, cerrarSesion } = useSesion();
  if (!usuario) return null;
  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant="link"
        className={estilos.perfil}
        id="selector-usuario"
        aria-label={`Perfil de ${usuario.nombre}, ${etiquetasRoles[usuario.rol]}`}
      >
        <span className={estilos.avatar}>{usuario.iniciales}</span>
        <span className={estilos.nombrePerfil}>
          <strong>{usuario.nombre}</strong>
          <small>{etiquetasRoles[usuario.rol]}</small>
        </span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Header>
          {usuario.nombre}
          <span className="d-block fw-normal mt-1">{etiquetasRoles[usuario.rol]}</span>
        </Dropdown.Header>
        <Dropdown.Item onClick={cerrarSesion}>
          <Icono nombre="box-arrow-right" /> Cerrar sesión
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
