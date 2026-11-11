import { useRef, useState } from 'react';
import { Alert, Button, Form, Table } from 'react-bootstrap';
import { useDatos } from '../../contextos/contexto-datos';
import { mensajeError } from '../../utilidades/formato';
import { descargarArchivo } from '../../../modulos/control-diario/utilidades/descargar';
import { leerExcelCatalogos, crearPlantillaCatalogos } from '../servicios/importar-excel';
import type { VistaImportacion } from '../tipos/catalogo';
export function ImportacionCatalogos() {
  const { base, guardarCatalogos } = useDatos();
  const baseVista = useRef(base);
  const [vista, cambiarVista] = useState<VistaImportacion>();
  const [ocupado, cambiarOcupado] = useState(false);
  const [error, cambiarError] = useState('');
  const [mensaje, cambiarMensaje] = useState('');
  const [confirmado, cambiarConfirmado] = useState(false);
  const [reemplazar, cambiarReemplazar] = useState(false);
  async function seleccionar(archivo?: File) {
    cambiarVista(undefined);
    cambiarConfirmado(false);
    cambiarReemplazar(false);
    cambiarMensaje('');
    cambiarError('');
    if (!archivo) return;
    cambiarOcupado(true);
    try {
      if (archivo.size > 5 * 1024 * 1024) throw new Error('El archivo no puede superar 5 MB.');
      baseVista.current = base;
      cambiarVista(await leerExcelCatalogos(await archivo.arrayBuffer(), archivo.name, base));
    } catch (error) {
      cambiarError(mensajeError(error));
    } finally {
      cambiarOcupado(false);
    }
  }
  const existentes = vista?.filas.filter((fila) => fila.existente).length ?? 0;
  const errores = vista?.filas.some((fila) => fila.errores.length) ?? false;
  const cantidad = (vista?.filas.length ?? 0) - (reemplazar ? 0 : existentes);
  async function guardar() {
    if (!vista || !confirmado || errores || ocupado || !cantidad) return;
    cambiarOcupado(true);
    cambiarError('');
    try {
      if (baseVista.current !== base)
        throw new Error(
          'Los datos cambiaron desde la vista previa. Vuelve a seleccionar el archivo y revisa la carga.',
        );
      await guardarCatalogos({ ...vista.carga, reemplazar });
      cambiarMensaje(
        `Carga inicial guardada: ${cantidad} registros. No se modificaron registros diarios.`,
      );
      cambiarVista(undefined);
      cambiarConfirmado(false);
    } catch (error) {
      cambiarError(mensajeError(error));
    } finally {
      cambiarOcupado(false);
    }
  }
  return (
    <div>
      <p>
        Importa catálogos una sola vez desde las hojas de la plantilla. Máximo 5 MB y 1000 registros
        por carga. No se importan operaciones diarias ni asignaciones históricas.
      </p>
      <Button
        variant="outline-primary"
        disabled={ocupado}
        onClick={() => {
          cambiarOcupado(true);
          void crearPlantillaCatalogos()
            .then((datos) =>
              descargarArchivo(
                datos,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Plantilla-catalogos.xlsx',
              ),
            )
            .catch((error: unknown) => cambiarError(mensajeError(error)))
            .finally(() => cambiarOcupado(false));
        }}
      >
        Descargar plantilla Excel
      </Button>
      <Form.Group controlId="archivoCatalogos" className="my-3">
        <Form.Label>Archivo de carga inicial (.xlsx)</Form.Label>
        <Form.Control
          type="file"
          accept=".xlsx"
          disabled={ocupado}
          onChange={(evento) => {
            const control = evento.target as HTMLInputElement;
            void seleccionar(control.files?.[0]);
            control.value = '';
          }}
        />
      </Form.Group>
      {ocupado && <p role="status">Procesando catálogos…</p>}
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {mensaje && (
        <Alert variant="success" role="status">
          {mensaje}
        </Alert>
      )}
      {vista && (
        <>
          <h3 className="h6">
            Vista previa · {vista.filas.length} registros · {existentes} existentes
          </h3>
          <div
            className="table-responsive"
            style={{ maxHeight: 320 }}
            tabIndex={0}
            role="region"
            aria-label="Vista previa de importación"
          >
            <Table size="sm">
              <thead>
                <tr>
                  <th>Catálogo / fila</th>
                  <th>Identificador</th>
                  <th>Nombre / equipo</th>
                  <th>Validación</th>
                  <th>Datos</th>
                </tr>
              </thead>
              <tbody>
                {vista.filas.map((fila) => (
                  <tr key={`${fila.hoja}-${fila.fila}`}>
                    <td>
                      {fila.hoja} · {fila.fila}
                    </td>
                    <td>{fila.identificador || 'Sin identificador'}</td>
                    <td>{fila.nombre}</td>
                    <td
                      className={
                        fila.errores.length
                          ? 'text-danger'
                          : fila.existente
                            ? 'text-warning-emphasis'
                            : 'text-success'
                      }
                    >
                      {fila.errores.join(' ') ||
                        (fila.existente ? 'Existente: se omite salvo confirmación' : 'Nuevo')}
                    </td>
                    <td>
                      <details>
                        <summary>Consultar datos de la fila</summary>
                        <dl>
                          {Object.entries(fila.datos).map(([campo, valor]) => (
                            <div key={campo}>
                              <dt>{campo}</dt>
                              <dd>{String(valor)}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {errores && (
            <Alert variant="warning">
              Corrige los errores y vuelve a seleccionar el archivo. No se guardará una carga
              parcial.
            </Alert>
          )}
          {existentes > 0 && (
            <Form.Check
              id="reemplazarCatalogos"
              className="my-3"
              label="Autorizo actualizar los identificadores existentes con los datos del archivo"
              checked={reemplazar}
              disabled={ocupado}
              onChange={(evento) => {
                cambiarReemplazar(evento.target.checked);
                cambiarConfirmado(false);
              }}
            />
          )}
          <Form.Check
            id="confirmarCatalogos"
            className="my-3"
            label={`Revisé la vista previa y confirmo guardar ${cantidad} registros`}
            checked={confirmado}
            disabled={ocupado || errores || cantidad === 0}
            onChange={(evento) => cambiarConfirmado(evento.target.checked)}
          />
          <Button
            disabled={ocupado || !confirmado || errores || cantidad === 0}
            onClick={() => void guardar()}
          >
            Confirmar importación
          </Button>
        </>
      )}
      {(base.importacionesCatalogos ?? []).length > 0 && (
        <details className="mt-4">
          <summary>Cargas realizadas</summary>
          <ul>
            {base.importacionesCatalogos?.map((registro) => (
              <li key={registro.huella}>
                {registro.nombreArchivo} · {new Date(registro.fecha).toLocaleString('es-MX')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
