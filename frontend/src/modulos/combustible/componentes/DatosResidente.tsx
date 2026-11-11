import { etiquetaPk } from '../../../compartido/utilidades/pk';
import type { Suministro } from '../tipos/suministro';
import estilos from './Combustible.module.css';
export function DatosResidente({
  suministro,
}: {
  suministro: Pick<Suministro, 'nombreResidente' | 'pkResidente'>;
}) {
  return (
    <div className={estilos.residente}>
      <span>{suministro.nombreResidente || 'Sin asignar'}</span>
      <small>{suministro.pkResidente ? etiquetaPk(suministro.pkResidente) : 'PK pendiente'}</small>
    </div>
  );
}
