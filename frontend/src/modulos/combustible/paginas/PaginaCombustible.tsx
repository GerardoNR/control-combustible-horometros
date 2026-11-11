import { textoMaquinaria } from '../../../compartido/utilidades/texto-maquinaria';
import { DetallesSuministro } from '../componentes/DetallesSuministro';
import { DatosResidente } from '../componentes/DatosResidente';
import estilosCombustible from '../componentes/Combustible.module.css';
import { useFiltrosPeriodo } from '../../../compartido/utilidades/useFiltrosPeriodo';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { CabeceraPagina } from '../../../compartido/componentes/CabeceraPagina';
import { Indicadores } from '../../../compartido/componentes/Indicadores';
import { GestorRegistros } from '../../../compartido/componentes/GestorRegistros';
import { FiltrosPeriodo } from '../../../compartido/componentes/Filtros';
import { DatosEquipo } from '../../../compartido/componentes/DatosEquipo';
import { fechaCorta, numero } from '../../../compartido/utilidades/formato';
import { FormularioSuministro } from '../formularios/FormularioSuministro';
import type { Columna } from '../../../compartido/componentes/TablaRegistros';
import type { Suministro } from '../tipos/suministro';
import estilos from '../../../compartido/componentes/Interfaz.module.css';
export function PaginaCombustible() {
  const { base } = useDatos();
  const filtros = useFiltrosPeriodo();
  const registros = base.combustible
    .filter(
      (registro) =>
        !registro.eliminado &&
        filtros.coincide(
          registro,
          `${textoMaquinaria(base, registro.maquinariaId)} ${registro.operador} ${registro.tipoCombustible} ${registro.nombreResidente ?? ''} ${registro.pkResidente ?? ''} ${registro.numeroOrquesta ?? ''} ${registro.nombreDespachador ?? ''}`,
        ),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horaCarga.localeCompare(a.horaCarga));
  const solicitados = registros.reduce((total, registro) => total + registro.litrosSolicitados, 0);
  const cargados = registros.reduce((total, registro) => total + registro.litrosCargados, 0);
  const columnas: Columna<Suministro>[] = [
    {
      titulo: 'Fecha',
      mostrar: (registro) => (
        <>
          {fechaCorta(registro.fecha)}
          <div className="small text-secondary">{registro.horaCarga} h</div>
        </>
      ),
    },
    {
      titulo: 'N° económico',
      mostrar: (registro) => <DatosEquipo id={registro.maquinariaId} campo="numeroEconomico" />,
    },
    {
      titulo: 'Maquinaria',
      mostrar: (registro) => <DatosEquipo id={registro.maquinariaId} campo="maquinaria" />,
    },
    { titulo: 'Tipo de combustible', mostrar: (registro) => registro.tipoCombustible },
    {
      titulo: 'Cantidad solicitada',
      mostrar: (registro) => `${numero(registro.litrosSolicitados, 2)} L`,
    },
    {
      titulo: 'Cantidad cargada',
      mostrar: (registro) => <strong>{numero(registro.litrosCargados, 2)} L</strong>,
    },
    { titulo: 'Operador', mostrar: (registro) => registro.operador },
    { titulo: 'Residente / PK', mostrar: (registro) => <DatosResidente suministro={registro} /> },
    { titulo: 'N° de orquesta', mostrar: (registro) => registro.numeroOrquesta || 'Sin registrar' },
    {
      titulo: 'Nombre del despachador',
      mostrar: (registro) => registro.nombreDespachador || 'Sin registrar',
    },
  ];
  return (
    <>
      <CabeceraPagina
        titulo="Combustible"
        descripcion="Controla cada carga y consulta los litros suministrados por equipo y periodo."
      />
      <Indicadores
        elementos={[
          {
            titulo: 'Litros suministrados',
            valor: (
              <>
                {numero(cargados, 2)} <small>L</small>
              </>
            ),
            detalle: 'Total de los registros filtrados',
            icono: 'fuel-pump',
            tono: 'verde',
          },
          {
            titulo: 'Litros solicitados',
            valor: (
              <>
                {numero(solicitados, 2)} <small>L</small>
              </>
            ),
            detalle: 'Solicitudes del periodo filtrado',
            icono: 'clipboard2-check',
          },
          {
            titulo: 'Diferencia de litros¹',
            valor: (
              <>
                {numero(solicitados - cargados, 2)} <small>L</small>
              </>
            ),
            detalle: 'Solicitados − cargados',
            icono: 'arrow-left-right',
            tono: 'ambar',
          },
        ]}
      />
      <div className={estilosCombustible.listado}>
        <GestorRegistros
          modulo="combustible"
          titulo="Registro de suministros"
          singular="suministro"
          registros={registros}
          columnas={columnas}
          contenidoConsulta={(registro) => <DetallesSuministro registro={registro} />}
          filtros={<FiltrosPeriodo filtros={filtros} />}
          sinMaquinaria={!base.maquinarias.length}
          formulario={(registro, cancelar, exito) => (
            <FormularioSuministro registro={registro} cancelar={cancelar} exito={exito} />
          )}
        />
      </div>
      <p className={estilos.nota}>
        ¹ Una diferencia negativa indica una carga mayor a la solicitada. El consumo L/h se consulta
        en Control Diario cuando coinciden equipo y fecha.
      </p>
    </>
  );
}
