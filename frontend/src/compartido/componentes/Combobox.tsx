import { forwardRef, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';
import FormContext from 'react-bootstrap/FormContext';
import { normalizarNombre } from '../catalogos/servicios/catalogos';
import estilos from './Combobox.module.css';

type Propiedades = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  opciones: string[];
  etiqueta?: string;
  permitirNuevo?: boolean;
  invalido?: boolean;
  claveOpcion?: (valor: string) => string;
  conservarTexto?: boolean;
};
export const Combobox = forwardRef<HTMLInputElement, Propiedades>(function Combobox(
  {
    opciones,
    etiqueta,
    permitirNuevo = false,
    invalido = false,
    claveOpcion = normalizarNombre,
    conservarTexto = false,
    readOnly,
    onChange,
    onBlur,
    ...propiedades
  },
  referencia,
) {
  const { controlId } = useContext(FormContext);
  const entrada = useRef<HTMLInputElement>(null);
  const listaId = useId();
  const [abierto, cambiarAbierto] = useState(false);
  const [consulta, cambiarConsulta] = useState('');
  const [activo, cambiarActivo] = useState(-1);
  const unicas = [
    ...new Map(opciones.filter(Boolean).map((opcion) => [claveOpcion(opcion), opcion])).values(),
  ];
  const filtradas = unicas.filter(
    (opcion) =>
      normalizarNombre(opcion).includes(normalizarNombre(consulta)) ||
      claveOpcion(opcion) === claveOpcion(consulta),
  );
  const nuevo =
    permitirNuevo &&
    consulta.trim() &&
    !unicas.some((opcion) => claveOpcion(opcion) === claveOpcion(consulta));
  const resultados = [
    ...filtradas,
    ...(nuevo ? [conservarTexto ? consulta : consulta.trim().replace(/\s+/g, ' ')] : []),
  ];
  useEffect(() => {
    if (abierto && activo >= 0)
      document.getElementById(`${listaId}-${activo}`)?.scrollIntoView({ block: 'nearest' });
  }, [abierto, activo, listaId]);
  function elegir(valor: string) {
    const nodo = entrada.current;
    if (!nodo) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(nodo, valor);
    onChange?.({
      target: nodo,
      currentTarget: nodo,
      type: 'change',
    } as ChangeEvent<HTMLInputElement>);
    nodo.focus();
    cambiarConsulta(valor);
    cambiarAbierto(false);
    cambiarActivo(-1);
  }
  return (
    <div
      className={estilos.control}
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) cambiarAbierto(false);
      }}
    >
      <div className={estilos.entrada}>
        <input
          {...propiedades}
          id={propiedades.id ?? controlId}
          className={`form-control ${invalido ? 'is-invalid' : ''} ${propiedades.className ?? ''}`}
          readOnly={readOnly}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={abierto && !readOnly}
          aria-controls={listaId}
          aria-activedescendant={abierto && activo >= 0 ? `${listaId}-${activo}` : undefined}
          autoComplete="off"
          ref={(nodo: HTMLInputElement | null) => {
            entrada.current = nodo;
            if (typeof referencia === 'function') referencia(nodo);
            else if (referencia) referencia.current = nodo;
          }}
          onFocus={() => {
            if (!readOnly) {
              cambiarConsulta(entrada.current?.value ?? '');
              cambiarActivo(-1);
              cambiarAbierto(true);
            }
          }}
          onChange={(evento) => {
            onChange?.(evento);
            cambiarConsulta(evento.target.value);
            cambiarActivo(-1);
            cambiarAbierto(true);
          }}
          onBlur={onBlur}
          onKeyDown={(evento) => {
            if (readOnly) return;
            if (evento.key === 'Tab') cambiarAbierto(false);
            if (evento.key === 'Escape' && abierto) {
              evento.preventDefault();
              evento.stopPropagation();
              cambiarAbierto(false);
            }
            if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
              evento.preventDefault();
              if (!abierto) {
                cambiarConsulta('');
                cambiarAbierto(true);
                cambiarActivo(0);
              } else
                cambiarActivo((anterior) =>
                  resultados.length
                    ? anterior < 0
                      ? evento.key === 'ArrowDown'
                        ? 0
                        : resultados.length - 1
                      : (anterior + (evento.key === 'ArrowDown' ? 1 : -1) + resultados.length) %
                        resultados.length
                    : -1,
                );
            }
            if (abierto && (evento.key === 'Home' || evento.key === 'End')) {
              evento.preventDefault();
              cambiarActivo(evento.key === 'Home' ? 0 : resultados.length - 1);
            }
            if (evento.key === 'Enter' && abierto) {
              evento.preventDefault();
              if (activo >= 0 && resultados[activo]) elegir(resultados[activo]);
              else cambiarAbierto(false);
            }
          }}
        />
        {!readOnly && (
          <button
            type="button"
            tabIndex={-1}
            className={estilos.flecha}
            aria-label={`Mostrar todas las opciones de ${etiqueta ?? propiedades.name ?? 'este campo'}`}
            aria-expanded={abierto}
            onMouseDown={(evento) => evento.preventDefault()}
            onClick={() => {
              entrada.current?.focus();
              cambiarConsulta('');
              cambiarActivo(-1);
              cambiarAbierto(true);
            }}
          >
            ▼
          </button>
        )}
      </div>
      {abierto && !readOnly && (
        <ul
          id={listaId}
          role="listbox"
          className={estilos.opciones}
          aria-label="Opciones disponibles"
        >
          {resultados.map((opcion, indice) => (
            <li
              key={claveOpcion(opcion)}
              id={`${listaId}-${indice}`}
              role="option"
              aria-selected={indice === activo}
              className={indice === activo ? estilos.activo : ''}
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => elegir(opcion)}
            >
              {nuevo && indice === resultados.length - 1 ? `Agregar nuevo: ${opcion}` : opcion}
            </li>
          ))}
          {!resultados.length && (
            <li role="presentation" className="text-secondary">
              Sin coincidencias
              {!permitirNuevo ? '. Solo el administrador puede agregar opciones.' : ''}
            </li>
          )}
        </ul>
      )}
    </div>
  );
});
