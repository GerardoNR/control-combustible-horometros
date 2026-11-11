import { coloresConsumo } from '../servicios/evaluacion-consumo';
import type { EstadoConsumo as Estado } from '../servicios/evaluacion-consumo';
import estilos from './IndicadorEstado.module.css';
export function EstadoConsumo({ estado }: { estado: Estado }) {
  const colores = coloresConsumo[estado];
  return (
    <span
      className={estilos.indicador}
      style={{ backgroundColor: colores.fondo, color: colores.texto }}
    >
      {estado}
    </span>
  );
}
