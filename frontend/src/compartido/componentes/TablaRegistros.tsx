import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Form, OverlayTrigger, Pagination, Table, Tooltip } from 'react-bootstrap';
import { Icono } from './Icono';
import estilos from './Interfaz.module.css';
export interface Columna<Registro> {
  titulo: string;
  mostrar: (registro: Registro) => ReactNode;
}
interface Propiedades<Registro extends { id: string }> {
  mostrarAcciones?: boolean;
  mostrarHistorial?: boolean;
  eliminar?: (registro: Registro) => void;
  editable: boolean;
  registros: Registro[];
  columnas: Columna<Registro>[];
  editar: (registro: Registro) => void;
  consultar: (registro: Registro) => void;
  historial: (registro: Registro) => void;
}
export function TablaRegistros<Registro extends { id: string }>({
  eliminar,
  mostrarAcciones = true,
  mostrarHistorial = true,
  editable,
  registros,
  columnas,
  editar,
  consultar,
  historial,
}: Propiedades<Registro>) {
  const [pagina, cambiarPagina] = useState(1);
  const [tamano, cambiarTamano] = useState(8);
  const paginas = Math.max(1, Math.ceil(registros.length / tamano));
  const actual = Math.min(pagina, paginas);
  const inicio = (actual - 1) * tamano;
  const renderizarAcciones = (registro: Registro) => (
    <div className={estilos.acciones} role="group" aria-label="Acciones del registro">
      <BotonAccion
        etiqueta="Consultar registro"
        icono="eye"
        clase={estilos.accionVer}
        ejecutar={() => consultar(registro)}
      />
      {editable && (
        <BotonAccion
          etiqueta="Editar registro"
          icono="pencil-square"
          clase={estilos.accionEditar}
          ejecutar={() => editar(registro)}
        />
      )}
      {editable && eliminar && (
        <BotonAccion
          etiqueta="Eliminar registro"
          icono="trash"
          clase={estilos.accionEliminar}
          ejecutar={() => eliminar(registro)}
        />
      )}
      {mostrarHistorial && (
        <BotonAccion
          etiqueta="Ver historial"
          icono="clock-history"
          clase={estilos.accionHistorial}
          ejecutar={() => historial(registro)}
        />
      )}
    </div>
  );
  return (
    <>
      <p className={estilos.ayudaTabla}>
        <Icono nombre="arrow-left-right" /> Desplázate horizontalmente para consultar todas las
        columnas.
      </p>
      <div
        className={estilos.tablaContenedor}
        tabIndex={0}
        role="region"
        aria-label="Tabla de registros, desplazable horizontalmente"
      >
        <Table className={estilos.tabla}>
          <thead>
            <tr>
              {columnas.map((columna) => (
                <th key={columna.titulo} scope="col">
                  {columna.titulo}
                </th>
              ))}
              {mostrarAcciones && (
                <th className={estilos.columnaAcciones} scope="col">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {registros.slice(inicio, inicio + tamano).map((registro) => (
              <tr key={registro.id}>
                {columnas.map((columna) => (
                  <td key={columna.titulo}>{columna.mostrar(registro)}</td>
                ))}
                {mostrarAcciones && (
                  <td className={estilos.columnaAcciones}>{renderizarAcciones(registro)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {!registros.length && (
        <div className={estilos.vacio}>
          <Icono nombre="inbox" />
          <h3>No hay registros para mostrar</h3>
          <p>Prueba con otros filtros o registra un nuevo elemento.</p>
        </div>
      )}
      <div className={estilos.pieTabla}>
        <span>
          Mostrando {registros.length ? inicio + 1 : 0}–
          {Math.min(inicio + tamano, registros.length)} de {registros.length} registros
        </span>
        <div className="d-flex align-items-center gap-3">
          <Form.Select
            size="sm"
            aria-label="Registros por página"
            value={tamano}
            onChange={(evento) => {
              cambiarTamano(Number(evento.target.value));
              cambiarPagina(1);
            }}
          >
            <option value={8}>8 por página</option>
            <option value={16}>16 por página</option>
            <option value={32}>32 por página</option>
          </Form.Select>
          <Pagination size="sm" className="mb-0">
            <Pagination.Prev
              disabled={actual === 1}
              onClick={() => cambiarPagina(actual - 1)}
              aria-label="Página anterior"
            />
            <Pagination.Item active>{actual}</Pagination.Item>
            <Pagination.Next
              disabled={actual === paginas}
              onClick={() => cambiarPagina(actual + 1)}
              aria-label="Página siguiente"
            />
          </Pagination>
        </div>
      </div>
    </>
  );
}

function BotonAccion({
  etiqueta,
  icono,
  clase,
  ejecutar,
}: {
  etiqueta: string;
  icono: string;
  clase: string;
  ejecutar: () => void;
}) {
  const id = useId();
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip id={id}>{etiqueta}</Tooltip>}>
      <Button
        variant="link"
        className={clase}
        onClick={ejecutar}
        aria-label={etiqueta}
        title={etiqueta}
      >
        <Icono nombre={icono} />
      </Button>
    </OverlayTrigger>
  );
}
