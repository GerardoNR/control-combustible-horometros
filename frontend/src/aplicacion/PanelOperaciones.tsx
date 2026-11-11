import { lazy, Suspense, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Alert, Button, Offcanvas, Spinner } from 'react-bootstrap';
import { Icono } from '../compartido/componentes/Icono';
import { useDatos } from '../compartido/contextos/contexto-datos';
import { MenuPerfil } from '../modulos/acceso/componentes/MenuPerfil';
import { Logotipo } from '../compartido/componentes/Logotipo';
const PaginaMaquinarias = lazy(() =>
  import('../modulos/maquinarias/paginas/PaginaMaquinarias').then((modulo) => ({
    default: modulo.PaginaMaquinarias,
  })),
);
const PaginaHorometros = lazy(() =>
  import('../modulos/horometros/paginas/PaginaHorometros').then((modulo) => ({
    default: modulo.PaginaHorometros,
  })),
);
const PaginaCombustible = lazy(() =>
  import('../modulos/combustible/paginas/PaginaCombustible').then((modulo) => ({
    default: modulo.PaginaCombustible,
  })),
);
const PaginaControlDiario = lazy(() =>
  import('../modulos/control-diario/paginas/PaginaControlDiario').then((modulo) => ({
    default: modulo.PaginaControlDiario,
  })),
);
import estilos from './Aplicacion.module.css';
const opciones = [
  { ruta: '/maquinarias', nombre: 'Maquinarias', icono: 'truck-front' },
  { ruta: '/horometros', nombre: 'Horómetros', icono: 'speedometer2' },
  { ruta: '/combustible', nombre: 'Combustible', icono: 'fuel-pump' },
  { ruta: '/control-diario', nombre: 'Control Diario', icono: 'journal-text' },
];
function Menu({ cerrar, compacto = false }: { cerrar: () => void; compacto?: boolean }) {
  return (
    <>
      <div className={estilos.marca}>
        <Logotipo claro compacto={compacto} />
      </div>
      <div className={estilos.etiquetaMenu}>ESPACIO DE TRABAJO</div>
      <nav aria-label="Navegación principal" className={estilos.navegacion}>
        {opciones.map((opcion) => (
          <NavLink
            key={opcion.ruta}
            to={opcion.ruta}
            title={opcion.nombre}
            onClick={cerrar}
            className={({ isActive }) => (isActive ? estilos.activo : undefined)}
          >
            <Icono nombre={opcion.icono} />
            <span>{opcion.nombre}</span>
            <Icono nombre="chevron-right" clase={estilos.flecha} />
          </NavLink>
        ))}
      </nav>
      <div className={estilos.pieLateral}>
        <span>Control de operaciones</span>
        <small>v1.0</small>
      </div>
    </>
  );
}
export function PanelOperaciones() {
  const [plegado, cambiarPlegado] = useState(false);
  const [movil, cambiarMovil] = useState(false);
  const { cargando, error, recargar } = useDatos();
  return (
    <div className={`${estilos.aplicacion} ${plegado ? estilos.plegado : ''}`}>
      <a href="#contenido" className={estilos.saltar}>
        Saltar al contenido
      </a>
      <aside className={estilos.lateral}>
        <Menu cerrar={() => undefined} compacto={plegado} />
      </aside>
      <Offcanvas
        show={movil}
        onHide={() => cambiarMovil(false)}
        className={estilos.menuMovil}
        aria-label="Menú de navegación"
      >
        <Offcanvas.Header closeButton closeVariant="white">
          <Offcanvas.Title>Menú principal</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Menu cerrar={() => cambiarMovil(false)} />
        </Offcanvas.Body>
      </Offcanvas>
      <div className={estilos.principal}>
        <header className={estilos.encabezado}>
          <div className="d-flex align-items-center gap-3">
            <Button
              variant="link"
              className={estilos.botonEscritorio}
              onClick={() => cambiarPlegado(!plegado)}
              aria-label={plegado ? 'Expandir menú' : 'Plegar menú'}
              aria-expanded={!plegado}
            >
              <Icono nombre="layout-sidebar" />
            </Button>
            <Button
              variant="link"
              className={estilos.botonMovil}
              onClick={() => cambiarMovil(true)}
              aria-label="Abrir menú"
              aria-expanded={movil}
            >
              <Icono nombre="list" />
            </Button>
            <span className={estilos.tituloEncabezado}>Control de Maquinaria</span>
          </div>
          <MenuPerfil />
        </header>
        <main id="contenido" className={estilos.contenido} tabIndex={-1}>
          {cargando ? (
            <div className={estilos.cargando} role="status">
              <Spinner />
              <p>Cargando información de maquinaria…</p>
            </div>
          ) : error ? (
            <Alert variant="danger">
              <Alert.Heading>No se pudo cargar la información</Alert.Heading>
              <p>{error}</p>
              <Button variant="outline-danger" onClick={() => void recargar()}>
                Reintentar
              </Button>
            </Alert>
          ) : (
            <Suspense
              fallback={
                <div className={estilos.cargando} role="status">
                  <Spinner />
                  <p>Cargando pantalla…</p>
                </div>
              }
            >
              <Routes>
                <Route path="/maquinarias" element={<PaginaMaquinarias />} />
                <Route path="/horometros" element={<PaginaHorometros />} />
                <Route path="/combustible" element={<PaginaCombustible />} />
                <Route path="/control-diario" element={<PaginaControlDiario />} />
                <Route path="*" element={<Navigate to="/maquinarias" replace />} />
              </Routes>
            </Suspense>
          )}
        </main>
        <footer className={estilos.pie}>
          <span>
            Control de Maquinaria <span>·</span> Maquinaria, horómetros y combustible
          </span>
        </footer>
      </div>
    </div>
  );
}
