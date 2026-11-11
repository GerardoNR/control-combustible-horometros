import { etiquetaPk } from '../../../compartido/utilidades/pk';
import { AlertaOperacion } from '../componentes/AlertaOperacion';
import { EstadoConsumo } from '../componentes/EstadoConsumo';
import { useMemo, useState } from 'react';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { CabeceraPagina } from '../../../compartido/componentes/CabeceraPagina';
import { Indicadores } from '../../../compartido/componentes/Indicadores';
import { GestorRegistros } from '../../../compartido/componentes/GestorRegistros';
import { DatosEquipo } from '../../../compartido/componentes/DatosEquipo';
import { fechaCorta, numero } from '../../../compartido/utilidades/formato';
import type { Columna } from '../../../compartido/componentes/TablaRegistros';
import type { FiltrosControl, OperacionConsolidada } from '../tipos/consolidado';
import { consolidarControlDiario } from '../servicios/consolidacion';
import { filtrosDeHoy, filtrarControlDiario } from '../utilidades/filtros-control';
import { totalizarControl } from '../utilidades/totales-control';
import { FiltrosControlDiario } from '../componentes/FiltrosControlDiario';
import { ExportacionesControl } from '../componentes/ExportacionesControl';
import { crearIndicadoresMaquinaria } from '../servicios/indicadores-maquinaria';
import estilosControl from './PaginaControlDiario.module.css';

function presentarResidenteUbicacion(registro: OperacionConsolidada) {
  return (
    <span>
      <span className="d-block">{registro.residente}</span>
      <small className="d-block text-secondary">{etiquetaPk(registro.pkUbicacion)}</small>
    </span>
  );
}

export function PaginaControlDiario() {
  const { base } = useDatos();
  const [filtros, cambiarFiltros] = useState<FiltrosControl>(filtrosDeHoy);
  const umbralHorasDiarias = undefined;
  const consolidados = useMemo(() => consolidarControlDiario(base), [base]);
  const registros = filtrarControlDiario(consolidados, filtros);
  const totales = totalizarControl(registros);
  const indicadores = crearIndicadoresMaquinaria(base, registros, filtros, umbralHorasDiarias);

  const columnas: Columna<OperacionConsolidada>[] = [
    { titulo: 'Fecha', mostrar: (registro) => fechaCorta(registro.fecha) },
    {
      titulo: 'N° económico',
      mostrar: (registro) => <DatosEquipo id={registro.maquinariaId} campo="numeroEconomico" />,
    },
    { titulo: 'Maquinaria', mostrar: (registro) => registro.maquinaria },
    { titulo: 'Operador', mostrar: (registro) => registro.operador || 'Pendiente' },
    {
      titulo: 'Residente / PK',
      mostrar: (registro) => presentarResidenteUbicacion(registro),
    },
    {
      titulo: 'Horas',
      mostrar: (registro) =>
        registro.horas === null ? (
          <span className="text-secondary">Pendiente</span>
        ) : (
          `${numero(registro.horas, 2)} h`
        ),
    },
    {
      titulo: 'Litros',
      mostrar: (registro) =>
        registro.litros === null ? (
          <span className="text-secondary">Pendiente</span>
        ) : (
          `${numero(registro.litros, 2)} L`
        ),
    },
    {
      titulo: 'Rendimiento (L/h)',
      mostrar: (registro) =>
        registro.litrosHora === null ? (
          <span className="text-secondary">Pendiente</span>
        ) : (
          <>
            <strong className="text-primary">{numero(registro.litrosHora, 3)} L/h</strong>
            {registro.horasLitro !== null && (
              <small className="d-block text-secondary mt-1">
                Inverso: {numero(registro.horasLitro, 3)} h/L
              </small>
            )}
          </>
        ),
    },
    {
      titulo: 'Alerta',
      mostrar: (registro) => <AlertaOperacion registro={registro} />,
    },
    {
      titulo: 'Estado del consumo',
      mostrar: (registro) => (
        <div>
          <EstadoConsumo estado={registro.estadoConsumo} />
        </div>
      ),
    },
  ];
  return (
    <div className={estilosControl.controlDiario}>
      <CabeceraPagina
        titulo="Control Diario"
        descripcion="Horas y cargas consolidadas automáticamente por maquinaria y fecha operativa."
      />
      <section className={estilosControl.resumen} aria-label="Resumen filtrado">
        <Indicadores
          elementos={[
            {
              titulo: 'Maquinarias con registros',
              valor: new Set(registros.map((registro) => registro.maquinariaId)).size,
              detalle: `${totales.registros} registros filtrados`,
              icono: 'journal-check',
            },
            {
              titulo: 'Horas trabajadas',
              valor: (
                <>
                  {numero(totales.horas, 2)} <small>h</small>
                </>
              ),
              detalle: 'Suma de lecturas válidas disponibles',
              icono: 'clock',
            },
            {
              titulo: 'Litros suministrados',
              valor: (
                <>
                  {numero(totales.litros, 2)} <small>L</small>
                </>
              ),
              detalle: 'Suma de litros realmente cargados',
              icono: 'fuel-pump',
              tono: 'verde',
            },
            {
              titulo: 'Consumo global L/h',
              valor:
                totales.litrosHora === null ? 'Pendiente' : `${numero(totales.litrosHora, 3)} L/h`,
              detalle: `${totales.parciales} registros con fuentes parciales`,
              icono: 'speedometer2',
              tono: 'ambar',
            },
          ]}
        />
      </section>
      <GestorRegistros
        modulo="control-diario"
        titulo="Bitácora de operaciones"
        singular="operación"
        registros={registros}
        columnas={columnas}
        herramientas={
          <ExportacionesControl
            registros={registros}
            filtros={filtros}
            indicadores={indicadores}
            umbralHorasDiarias={umbralHorasDiarias}
            maquinaria={
              base.maquinarias.find((maquinaria) => maquinaria.id === filtros.maquinaria)
                ?.numeroEconomico ?? ''
            }
          />
        }
        filtros={
          <FiltrosControlDiario
            filtros={filtros}
            cambiar={(campo, valor) => cambiarFiltros((actual) => ({ ...actual, [campo]: valor }))}
            limpiar={() => cambiarFiltros(filtrosDeHoy())}
          />
        }
        sinMaquinaria={!base.maquinarias.length}
      />
    </div>
  );
}
