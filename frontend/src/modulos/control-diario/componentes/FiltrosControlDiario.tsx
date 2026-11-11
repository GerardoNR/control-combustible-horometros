import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Buscador } from '../../../compartido/componentes/Filtros';
import { Icono } from '../../../compartido/componentes/Icono';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import type { FiltrosControl } from '../tipos/consolidado';
import { periodoInvalido } from '../utilidades/filtros-control';
import estilosControl from '../paginas/PaginaControlDiario.module.css';
import estilos from '../../../compartido/componentes/Interfaz.module.css';
export function FiltrosControlDiario({
  filtros,
  cambiar,
  limpiar,
}: {
  filtros: FiltrosControl;
  cambiar: (campo: keyof FiltrosControl, valor: string) => void;
  limpiar: () => void;
}) {
  const { base } = useDatos();
  const [error, cambiarError] = useState('');
  function seleccionarFecha(campo: 'desde' | 'hasta', valor: string) {
    if (periodoInvalido({ ...filtros, [campo]: valor })) {
      cambiarError('La fecha desde debe ser anterior o igual a la fecha hasta.');
      return;
    }
    cambiarError('');
    cambiar(campo, valor);
  }
  return (
    <>
      <Buscador
        valor={filtros.busqueda}
        cambiar={(valor) => cambiar('busqueda', valor)}
        placeholder="Buscar N° económico o maquinaria…"
      />
      <Form.Select
        aria-label="Filtrar por maquinaria"
        value={filtros.maquinaria}
        onChange={(evento) => cambiar('maquinaria', evento.target.value)}
      >
        <option value="">Todas las maquinarias</option>
        {base.maquinarias.map((maquinaria) => (
          <option key={maquinaria.id} value={maquinaria.id}>
            {maquinaria.numeroEconomico} · {maquinaria.tipo}
          </option>
        ))}
      </Form.Select>
      {(
        [
          { campo: 'desde', etiqueta: 'Fecha desde' },
          { campo: 'hasta', etiqueta: 'Fecha hasta' },
        ] as const
      ).map((item) => (
        <div className={estilos.fechaFiltro} key={item.campo}>
          <label htmlFor={item.campo}>{item.etiqueta}</label>
          <div className={estilosControl.selectorFecha}>
            <Form.Control
              type="date"
              lang="es-MX"
              id={item.campo}
              min={item.campo === 'hasta' ? filtros.desde || undefined : undefined}
              max={item.campo === 'desde' ? filtros.hasta || undefined : undefined}
              value={filtros[item.campo]}
              isInvalid={!!error}
              onChange={(evento) => seleccionarFecha(item.campo, evento.target.value)}
            />
            {filtros[item.campo] && (
              <time aria-hidden="true" dateTime={filtros[item.campo]}>
                {filtros[item.campo].split('-').reverse().join('/')}
              </time>
            )}
          </div>
        </div>
      ))}
      <Form.Control
        className="w-auto flex-grow-1"
        maxLength={120}
        aria-label="Filtrar por operador"
        placeholder="Operador"
        value={filtros.operador}
        onChange={(evento) => cambiar('operador', evento.target.value)}
      />
      <Button
        variant="light"
        onClick={() => {
          cambiarError('');
          limpiar();
        }}
        aria-label="Limpiar filtros"
        title="Limpiar filtros"
      >
        <Icono nombre="arrow-counterclockwise" />
      </Button>
      {error && (
        <p role="alert" className="small text-danger w-100 mb-0">
          {error}
        </p>
      )}
    </>
  );
}
