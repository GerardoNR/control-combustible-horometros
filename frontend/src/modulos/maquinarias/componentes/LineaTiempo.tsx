import type { ReactNode } from 'react';
import estilos from './DetallesMaquinaria.module.css';
export interface EventoConsulta {
  id: string;
  titulo: string;
  periodo: string;
  estado?: string;
  datos: [string, ReactNode][];
}
export function LineaTiempo({
  eventos,
  vacio,
  etiqueta,
}: {
  eventos: EventoConsulta[];
  vacio: string;
  etiqueta: string;
}) {
  if (!eventos.length) return <p className={estilos.vacio}>{vacio}</p>;
  return (
    <div role="region" aria-label={etiqueta}>
      <ol className={estilos.lineaTiempo}>
        {eventos.map((evento) => (
          <li key={evento.id} className={estilos.evento}>
            <div className={estilos.cabeceraEvento}>
              <h4>{evento.titulo}</h4>
              {evento.estado && <span className={estilos.periodo}>{evento.estado}</span>}
            </div>
            <p className={estilos.fechas}>{evento.periodo}</p>
            <dl className={estilos.datosEvento}>
              {evento.datos.map(([etiqueta, valor]) => (
                <div key={etiqueta}>
                  <dt>{etiqueta}</dt>
                  <dd>{valor || 'Sin registrar'}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}
