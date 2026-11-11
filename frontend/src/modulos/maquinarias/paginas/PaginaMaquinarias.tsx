import { etiquetaPk } from '../../../compartido/utilidades/pk';
import { operadorEnInstante, residenteMaquinaria } from '../servicios/responsables';
import { evaluarMantenimiento } from '../servicios/mantenimiento';
import { DetallesMaquinaria } from '../componentes/DetallesMaquinaria';
import {
  UltimoMantenimiento,
  ProximoMantenimiento,
  LecturaHorometro,
} from '../componentes/MantenimientoMaquinaria';
import { useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { CabeceraPagina } from '../../../compartido/componentes/CabeceraPagina';
import { Indicadores } from '../../../compartido/componentes/Indicadores';
import { GestorRegistros } from '../../../compartido/componentes/GestorRegistros';
import { Buscador } from '../../../compartido/componentes/Filtros';
import { DatosEquipo, EstadoMaquinaria } from '../../../compartido/componentes/DatosEquipo';
import { Icono } from '../../../compartido/componentes/Icono';
import { FormularioEdicionMaquinaria } from '../formularios/FormularioEdicionMaquinaria';
import type { Columna } from '../../../compartido/componentes/TablaRegistros';
import type { Maquinaria } from '../tipos/maquinaria';
export function PaginaMaquinarias() {
  const { base } = useDatos();
  const [busqueda, cambiarBusqueda] = useState('');
  const [estado, cambiarEstado] = useState('');
  const [tipo, cambiarTipo] = useState('');
  const registros = base.maquinarias.filter(
    (equipo) =>
      (!estado || equipo.estado === estado) &&
      (!tipo || equipo.tipo === tipo) &&
      [equipo.numeroEconomico, equipo.placas, equipo.tipo, equipo.marca, equipo.modelo]
        .join(' ')
        .toLocaleLowerCase('es')
        .includes(busqueda.toLocaleLowerCase('es')),
  );
  const mantenimientos = useMemo(
    () =>
      new Map(base.maquinarias.map((equipo) => [equipo.id, evaluarMantenimiento(equipo, base)])),
    [base],
  );
  const columnas: Columna<Maquinaria>[] = [
    { titulo: 'N° económico', mostrar: (registro) => <strong>{registro.numeroEconomico}</strong> },
    {
      titulo: 'Maquinaria',
      mostrar: (registro) => <DatosEquipo id={registro.id} campo="maquinaria" />,
    },
    {
      titulo: 'Operador',
      mostrar: (registro) => operadorEnInstante(base, registro.id)?.operador ?? 'Sin asignar',
    },
    { titulo: 'Marca', mostrar: (registro) => registro.marca },
    { titulo: 'Modelo', mostrar: (registro) => registro.modelo },
    { titulo: 'Estado', mostrar: (registro) => <EstadoMaquinaria estado={registro.estado} /> },
    {
      titulo: 'Último horómetro',
      mostrar: (registro) => (
        <strong className="font-monospace">
          <LecturaHorometro valor={mantenimientos.get(registro.id)!.actual} />
        </strong>
      ),
    },
    {
      titulo: 'Residente / PK',
      mostrar: (registro) => {
        const residente = residenteMaquinaria(base, registro);
        return (
          <>
            <span>{residente?.nombre || 'Sin asignar'}</span>
            <small className="d-block text-secondary">
              {residente?.pk ? etiquetaPk(residente.pk) : 'PK sin asignar'}
            </small>
          </>
        );
      },
    },
    {
      titulo: 'Último mantenimiento',
      mostrar: (registro) => <UltimoMantenimiento resumen={mantenimientos.get(registro.id)!} />,
    },
    {
      titulo: 'Próximo mantenimiento',
      mostrar: (registro) => <ProximoMantenimiento resumen={mantenimientos.get(registro.id)!} />,
    },
  ];
  return (
    <>
      <CabeceraPagina
        titulo="Maquinarias"
        descripcion="Toda tu maquinaria, bajo control. Administra y consulta el estado de cada equipo."
      />
      <Indicadores
        elementos={[
          {
            titulo: 'Total de maquinarias',
            valor: base.maquinarias.length,
            detalle: 'Equipos registrados en la flota',
          },
          {
            titulo: 'Operativas',
            valor: base.maquinarias.filter((equipo) => equipo.estado === 'Operativa').length,
            detalle: 'Disponibles para operación',
            icono: 'check2-circle',
            tono: 'verde',
          },
          {
            titulo: 'En mantenimiento',
            valor: base.maquinarias.filter((equipo) => equipo.estado === 'En mantenimiento').length,
            detalle: 'En revisión o reparación',
            icono: 'tools',
            tono: 'ambar',
          },
          {
            titulo: 'Fuera de servicio',
            valor: base.maquinarias.filter((equipo) => equipo.estado === 'Fuera de servicio')
              .length,
            detalle: 'Equipos sin disponibilidad',
            icono: 'pause-circle',
            tono: 'rojo',
          },
        ]}
      />
      <GestorRegistros
        modulo="maquinarias"
        titulo="Listado de maquinarias"
        singular="maquinaria"
        registros={registros}
        columnas={columnas}
        contenidoConsulta={(registro) => <DetallesMaquinaria registro={registro} />}
        filtros={
          <>
            <Buscador
              valor={busqueda}
              cambiar={cambiarBusqueda}
              placeholder="Buscar número, placas, marca…"
            />
            <Form.Select
              aria-label="Filtrar por estado"
              value={estado}
              onChange={(evento) => cambiarEstado(evento.target.value)}
            >
              <option value="">Todos los estados</option>
              <option>Operativa</option>
              <option>En mantenimiento</option>
              <option>Fuera de servicio</option>
            </Form.Select>
            <Form.Select
              aria-label="Filtrar por tipo"
              value={tipo}
              onChange={(evento) => cambiarTipo(evento.target.value)}
            >
              <option value="">Todos los tipos</option>
              {[...new Set(base.maquinarias.map((equipo) => equipo.tipo))].sort().map((tipo) => (
                <option key={tipo}>{tipo}</option>
              ))}
            </Form.Select>
            <Button
              variant="light"
              title="Limpiar filtros"
              aria-label="Limpiar filtros"
              onClick={() => {
                cambiarBusqueda('');
                cambiarEstado('');
                cambiarTipo('');
              }}
            >
              <Icono nombre="arrow-counterclockwise" />
            </Button>
          </>
        }
        formulario={(registro, cancelar, exito) => (
          <FormularioEdicionMaquinaria registro={registro} cancelar={cancelar} exito={exito} />
        )}
      />
    </>
  );
}
