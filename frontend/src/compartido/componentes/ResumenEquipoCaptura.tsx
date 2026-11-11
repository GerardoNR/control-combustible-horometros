import { residenteMaquinaria } from '../../modulos/maquinarias/servicios/responsables';
import { etiquetaPk } from '../utilidades/pk';
import { useDatos } from '../contextos/contexto-datos';
import { asignacionParaFecha } from '../servicios/captura-diaria';
import { fechaCalendario } from '../utilidades/formato';
export function ResumenEquipoCaptura({
  maquinariaId,
  mostrarResidente = false,
}: {
  maquinariaId: string;
  mostrarResidente?: boolean;
}) {
  const { base } = useDatos();
  const equipo = base.maquinarias.find((equipo) => equipo.id === maquinariaId);
  if (!equipo) return null;
  const asignacion = asignacionParaFecha(base, maquinariaId, fechaCalendario(new Date()));
  const residente = mostrarResidente ? residenteMaquinaria(base, equipo) : undefined;
  return (
    <div className="rounded border bg-light p-3 small" style={{ gridColumn: '1 / -1' }}>
      <strong>
        {equipo.numeroEconomico} · {equipo.tipo}
      </strong>
      <span className="d-block text-secondary">
        {equipo.marca} · {equipo.modelo} · {equipo.estado}
      </span>
      <span className="d-block text-secondary">
        Operador vigente: {asignacion?.operador ?? 'Sin asignación registrada'}
      </span>
      {residente && (
        <span className="d-block text-secondary">
          Residente vigente: {residente.nombre}
          {residente.pk ? ` · ${etiquetaPk(residente.pk)}` : ''}
        </span>
      )}
    </div>
  );
}
