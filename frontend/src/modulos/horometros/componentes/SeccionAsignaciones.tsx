import { Table } from 'react-bootstrap';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { fechaHistorial } from '../../../compartido/utilidades/presentacion-historial';
import { fechaCorta } from '../../../compartido/utilidades/formato';
import estilos from './Horometros.module.css';

export function SeccionAsignaciones({ maquinariaId }: { maquinariaId: string }) {
  const { base } = useDatos();
  const historial = (base.asignacionesOperadores ?? [])
    .filter((asignacion) => asignacion.maquinariaId === maquinariaId)
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  const equipo = base.maquinarias.find((maquinaria) => maquinaria.id === maquinariaId);
  const vigente = historial.find((asignacion) => asignacion.fin === null);
  const formatoFecha = (valor: string) => fechaCorta(valor.slice(0, 10));

  return (
    <section className={estilos.seccion} aria-label="Movimientos de operadores">
      <div className={estilos.encabezado}>
        <div>
          <h3>Movimientos de operadores</h3>
          <p>Operador vigente: <strong>{vigente?.operador ?? 'Sin asignación registrada'}</strong></p>
        </div>
      </div>
      {!historial.length ? (
        <p className={estilos.vacio}>No hay movimientos de operadores registrados para esta maquinaria.</p>
      ) : (
        <div className={estilos.movimientos} tabIndex={0} role="region" aria-label="Historial cronológico de operadores">
          <Table>
            <thead><tr><th>Operador anterior</th><th>Operador asignado</th><th>Maquinaria</th><th>Inicio</th><th>Fin</th><th>Motivo</th><th>Usuario responsable</th></tr></thead>
            <tbody>
              {historial.map((asignacion) => (
                <tr key={asignacion.id}>
                  <td>{historial.find((anterior) => anterior.id === asignacion.asignacionAnteriorId)?.operador ?? 'Sin asignación anterior registrada'}</td>
                  <td>{asignacion.operador}</td>
                  <td>{equipo ? `${equipo.numeroEconomico} · ${equipo.tipo}` : maquinariaId}</td>
                  <td>{formatoFecha(asignacion.inicio)}</td>
                  <td>{asignacion.fin ? formatoFecha(asignacion.fin) : 'Vigente'}</td>
                  <td>{asignacion.motivo}</td>
                  <td>{asignacion.usuarioResponsableNombre}<small>Registrado: {fechaHistorial(asignacion.registradoEn)}</small></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}
