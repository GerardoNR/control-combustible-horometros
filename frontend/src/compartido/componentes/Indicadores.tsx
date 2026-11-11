import type { ReactNode } from 'react';
import { Icono } from './Icono';
import estilos from './Interfaz.module.css';
export interface Indicador {
  titulo: string;
  valor: ReactNode;
  detalle: string;
  icono?: string;
  tono?: 'azul' | 'verde' | 'ambar' | 'rojo' | 'gris';
}
export function Indicadores({ elementos }: { elementos: Indicador[] }) {
  return (
    <div className={estilos.indicadores} data-cantidad={elementos.length}>
      {elementos.map((elemento) => (
        <article
          key={elemento.titulo}
          className={`${estilos.indicador} ${estilos[elemento.tono ?? 'azul']}`}
        >
          <div className={estilos.indicadorCabecera}>
            <span>{elemento.titulo}</span>
            {elemento.icono && <span className={`${estilos.iconoIndicador} ${estilos[elemento.tono ?? 'azul']}`}>
              <Icono nombre={elemento.icono} />
            </span>}
          </div>
          <div
            className={`${estilos.valor} ${typeof elemento.valor === 'string' ? estilos.valorTexto : ''}`}
          >
            {elemento.valor}
          </div>
          <span className={estilos.detalle}>{elemento.detalle}</span>
        </article>
      ))}
    </div>
  );
}
