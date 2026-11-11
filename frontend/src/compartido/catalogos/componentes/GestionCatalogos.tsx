import { useState } from 'react';
import { Alert, Button, Form, Modal, Tab, Tabs, Table } from 'react-bootstrap';
import { useDatos } from '../../contextos/contexto-datos';
import { puedeAdministrar } from '../../../modulos/acceso/servicios/permisos';
import { ImportacionCatalogos } from './ImportacionCatalogos';
import { FormularioCatalogo } from './FormularioCatalogo';
import type { EntradaCatalogo } from '../tipos/catalogo';
export function GestionCatalogos({ cerrar }: { cerrar: () => void }) {
  const { base, usuario } = useDatos();
  const [busqueda, cambiarBusqueda] = useState('');
  const [formulario, cambiarFormulario] = useState<EntradaCatalogo | 'nuevo'>();
  if (!puedeAdministrar(usuario)) return null;
  const entradas = (base.catalogos ?? []).filter((entrada) =>
    `${entrada.tipo} ${entrada.codigo} ${entrada.nombre}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );
  return (
    <Modal
      show
      onHide={cerrar}
      size="xl"
      centered
      backdrop="static"
      aria-labelledby="titulo-catalogos"
    >
      <Modal.Header closeButton closeLabel="Cerrar catálogos">
        <Modal.Title id="titulo-catalogos">Catálogos y carga inicial</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info" role="note">
          Persistencia local temporal. Los registros diarios conservan los nombres históricos aunque
          cambien los catálogos. Maquinarias se agregan y editan desde su pantalla.
        </Alert>
        <Tabs defaultActiveKey="catalogos" className="mb-3">
          <Tab eventKey="catalogos" title="Catálogos">
            {formulario ? (
              <FormularioCatalogo
                key={typeof formulario === 'string' ? formulario : formulario.id}
                entrada={formulario === 'nuevo' ? undefined : formulario}
                terminar={() => cambiarFormulario(undefined)}
              />
            ) : (
              <>
                <div className="d-flex gap-2 mb-3">
                  <Form.Control
                    aria-label="Buscar en catálogos"
                    placeholder="Buscar nombre, identificador o catálogo…"
                    value={busqueda}
                    onChange={(evento) => cambiarBusqueda(evento.target.value)}
                  />
                  <Button onClick={() => cambiarFormulario('nuevo')}>Agregar registro</Button>
                </div>
                <div
                  className="table-responsive"
                  style={{ maxHeight: 400 }}
                  tabIndex={0}
                  role="region"
                  aria-label="Registros de catálogos"
                >
                  <Table size="sm">
                    <thead>
                      <tr>
                        <th>Catálogo</th>
                        <th>Identificador</th>
                        <th>Nombre</th>
                        <th>PK</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entradas.map((entrada) => (
                        <tr key={entrada.id}>
                          <td>{entrada.tipo}</td>
                          <td>{entrada.codigo}</td>
                          <td>{entrada.nombre}</td>
                          <td>{entrada.pk || 'Sin registrar'}</td>
                          <td>{entrada.activo ? 'Activo' : 'Inactivo'}</td>
                          <td>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              aria-label={`Editar ${entrada.codigo}`}
                              onClick={() => cambiarFormulario(entrada)}
                            >
                              Editar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                {!entradas.length && <p>Sin registros que coincidan con la búsqueda.</p>}
              </>
            )}
          </Tab>
          <Tab eventKey="importar" title="Importar Excel">
            <ImportacionCatalogos />
          </Tab>
        </Tabs>
      </Modal.Body>
    </Modal>
  );
}
