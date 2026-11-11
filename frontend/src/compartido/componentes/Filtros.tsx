import { Button, Form, InputGroup } from 'react-bootstrap';
import { useDatos } from '../contextos/contexto-datos';
import { Icono } from './Icono';
import type { useFiltrosPeriodo } from '../utilidades/useFiltrosPeriodo';
import estilos from './Interfaz.module.css';
export function Buscador({
  valor,
  cambiar,
  placeholder = 'Buscar registros…',
}: {
  valor: string;
  cambiar: (valor: string) => void;
  placeholder?: string;
}) {
  return (
    <InputGroup className={estilos.buscador}>
      <InputGroup.Text>
        <Icono nombre="search" />
      </InputGroup.Text>
      <Form.Control
        aria-label="Buscar registros"
        placeholder={placeholder}
        value={valor}
        onChange={(evento) => cambiar(evento.target.value)}
      />
    </InputGroup>
  );
}
export function FiltrosPeriodo({ filtros }: { filtros: ReturnType<typeof useFiltrosPeriodo> }) {
  const { base } = useDatos();
  return (
    <>
      <Buscador
        valor={filtros.busqueda}
        cambiar={filtros.cambiarBusqueda}
        placeholder="Buscar equipo u operador…"
      />
      <Form.Select
        className={estilos.filtroEquipo}
        aria-label="Filtrar por maquinaria"
        value={filtros.equipo}
        onChange={(evento) => filtros.cambiarEquipo(evento.target.value)}
      >
        <option value="">Todas las maquinarias</option>
        {base.maquinarias.map((equipo) => (
          <option value={equipo.id} key={equipo.id}>
            {equipo.numeroEconomico}
          </option>
        ))}
      </Form.Select>
      <div className={estilos.fechaFiltro}>
        <label htmlFor="desde">Desde</label>
        <Form.Control
          type="date"
          id="desde"
          min="2000-01-01"
          max="2100-12-31"
          value={filtros.desde}
          onChange={(evento) => filtros.cambiarDesde(evento.target.value)}
        />
      </div>
      <div className={estilos.fechaFiltro}>
        <label htmlFor="hasta">Hasta</label>
        <Form.Control
          type="date"
          id="hasta"
          min={filtros.desde || '2000-01-01'}
          max="2100-12-31"
          isInvalid={filtros.invalido}
          value={filtros.hasta}
          onChange={(evento) => filtros.cambiarHasta(evento.target.value)}
        />
      </div>
      <Button
        variant="light"
        title="Limpiar filtros"
        aria-label="Limpiar filtros"
        onClick={filtros.limpiar}
      >
        <Icono nombre="arrow-counterclockwise" />
      </Button>
      {filtros.invalido && (
        <p role="alert" className="text-danger small w-100 mb-0">
          La fecha final debe ser posterior o igual a la inicial.
        </p>
      )}
    </>
  );
}
