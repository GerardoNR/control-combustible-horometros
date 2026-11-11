import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { useSesion } from '../modulos/acceso/contextos/contexto-sesion';
import { PaginaAcceso } from '../modulos/acceso/paginas/PaginaAcceso';
import { ProveedorDatos } from '../compartido/contextos/ProveedorDatos';
import { PanelOperaciones } from './PanelOperaciones';
import estilos from './Aplicacion.module.css';
export function Aplicacion() {
  const { usuario, cargando, error, reintentar } = useSesion();
  const ubicacion = useLocation();
  if (cargando)
    return (
      <div className={estilos.cargando} role="status">
        <Spinner />
        <p>Preparando acceso…</p>
      </div>
    );
  if (error)
    return (
      <div className="container py-5">
        <Alert variant="danger">
          <Alert.Heading>No se pudo preparar el acceso</Alert.Heading>
          <p>{error}</p>
          <Button onClick={() => void reintentar()}>Reintentar</Button>
        </Alert>
      </div>
    );
  const destino =
    typeof ubicacion.state?.desde === 'string' &&
    /^\/(maquinarias|horometros|combustible|control-diario)$/.test(ubicacion.state.desde)
      ? ubicacion.state.desde
      : '/maquinarias';
  return (
    <Routes>
      <Route
        path="/acceso"
        element={usuario ? <Navigate to={destino} replace /> : <PaginaAcceso />}
      />
      <Route
        path="*"
        element={
          usuario ? (
            <ProveedorDatos key={usuario.id}>
              <PanelOperaciones />
            </ProveedorDatos>
          ) : (
            <Navigate to="/acceso" replace state={{ desde: ubicacion.pathname }} />
          )
        }
      />
    </Routes>
  );
}
