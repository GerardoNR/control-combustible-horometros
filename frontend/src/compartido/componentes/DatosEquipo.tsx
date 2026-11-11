import { useDatos } from '../contextos/contexto-datos';
import estilos from './Interfaz.module.css';
export function DatosEquipo({
  id,
  campo = 'resumen',
}: {
  id: string;
  campo?: 'resumen' | 'numeroEconomico' | 'maquinaria';
}) {
  const { base } = useDatos();
  const equipo = base.maquinarias.find((equipo) => equipo.id === id);
  if (campo === 'numeroEconomico')
    return <strong>{equipo?.numeroEconomico ?? 'Equipo no disponible'}</strong>;
  return (
    <div className={estilos.equipo}>
      <div>
        <strong>
          {equipo
            ? campo === 'maquinaria'
              ? equipo.tipo
              : equipo.numeroEconomico
            : 'Equipo no disponible'}
        </strong>
        {campo === 'resumen' && <small>{equipo ? `${equipo.tipo} · ${equipo.marca}` : id}</small>}
      </div>
    </div>
  );
}
export function EstadoMaquinaria({ estado }: { estado: string }) {
  return (
    <span
      className={`${estilos.estado} ${estado === 'Operativa' ? estilos.operativa : estado === 'En mantenimiento' ? estilos.mantenimiento : estilos.fuera}`}
    >
      {estado}
    </span>
  );
}
