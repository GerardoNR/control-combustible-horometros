import type { Auditoria } from '../tipos/datos';
import { useDatos } from '../contextos/contexto-datos';
import {
  cambiosRelevantes,
  etiquetaHistorial,
  fechaHistorial,
  valorHistorial,
} from '../utilidades/presentacion-historial';
import { Icono } from './Icono';
import estilos from './Interfaz.module.css';
export function HistorialRegistro({
  registro,
  camposOcultos = [],
}: {
  registro: Auditoria;
  camposOcultos?: string[];
}) {
  const { base } = useDatos();
  return (
    <div className={estilos.historial}>
      {[...registro.historial].reverse().map((cambio, indice) => (
        <article key={`${cambio.fecha}-${indice}`}>
          <div className={estilos.evento}>
            <span className={estilos.eventoIcono}>
              <Icono
                nombre={
                  cambio.accion === 'Creación'
                    ? 'plus-lg'
                    : cambio.accion === 'Eliminación'
                      ? 'trash'
                      : 'pencil'
                }
              />
            </span>
            <div>
              <strong>{cambio.accion} del registro</strong>
              <p>
                {cambio.usuarioNombre} · {fechaHistorial(cambio.fecha)}
              </p>
            </div>
          </div>
          <dl className={estilos.cambios}>
            {cambiosRelevantes(cambio.valores, cambio.anteriores)
              .filter(([campo]) => !camposOcultos.includes(campo))
              .map(([campo, valor]) => (
                <div key={campo}>
                  <dt>{etiquetaHistorial(campo)}</dt>
                  <dd>
                    {cambio.anteriores?.[campo] !== undefined && (
                      <>
                        <del>{valorHistorial(campo, cambio.anteriores[campo], base)}</del> →{' '}
                      </>
                    )}
                    {valorHistorial(campo, valor, base)}
                  </dd>
                </div>
              ))}
          </dl>
          {cambio.anteriores &&
            Object.entries(cambio.valores).every(
              ([campo, valor]) => cambio.anteriores?.[campo] === valor,
            ) && <p className="small text-secondary">Se guardó sin modificar valores.</p>}
        </article>
      ))}
    </div>
  );
}
