import type { ReactNode } from 'react';
import type { Auditoria } from '../tipos/datos';
import { fechaHistorial } from '../utilidades/presentacion-historial';
import { HistorialRegistro } from './HistorialRegistro';
import estilos from './ConsultaRegistro.module.css';
export function SeccionConsulta({
  titulo,
  datos,
}: {
  titulo: string;
  datos: [string, ReactNode][];
}) {
  return (
    <section className={estilos.seccion} aria-label={titulo}>
      <h3>{titulo}</h3>
      <dl>
        {datos.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>
              {valor === undefined || valor === null || valor === '' ? 'Sin registrar' : valor}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function AuditoriaConsulta({
  registro,
  camposOcultos = [],
}: {
  registro: Auditoria;
  camposOcultos?: string[];
}) {
  return (
    <section className={estilos.auditoria} aria-label="Información de creación y modificación">
      <p>
        Creado por <strong>{registro.creadoPor}</strong> · {fechaHistorial(registro.creadoEn)}
        <br />
        Última modificación por <strong>{registro.modificadoPor}</strong> ·{' '}
        {fechaHistorial(registro.modificadoEn)}
      </p>
      <details>
        <summary>Historial de modificaciones</summary>
        <HistorialRegistro registro={registro} camposOcultos={camposOcultos} />
      </details>
    </section>
  );
}
