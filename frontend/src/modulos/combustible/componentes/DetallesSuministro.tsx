import { residenteMaquinaria } from '../../maquinarias/servicios/responsables';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import {
  SeccionConsulta,
  AuditoriaConsulta,
} from '../../../compartido/componentes/ConsultaRegistro';
import { fechaCorta, fechaHora, numero } from '../../../compartido/utilidades/formato';
import type { Suministro } from '../tipos/suministro';
export function DetallesSuministro({ registro }: { registro: Suministro }) {
  const { base } = useDatos();
  const equipo = base.maquinarias.find((equipo) => equipo.id === registro.maquinariaId);
  const vigente = residenteMaquinaria(base, equipo);
  const coincideConCaptura =
    !!vigente &&
    vigente.nombre === registro.nombreResidente &&
    (vigente.pk ?? '') === (registro.pkResidente ?? '');
  const fechaAsignacion = vigente?.inicio ? fechaHora(vigente.inicio) : 'Sin periodo registrado';
  return (
    <>
      <SeccionConsulta
        titulo="Maquinaria y suministro"
        datos={[
          ['Número económico', equipo?.numeroEconomico ?? registro.maquinariaId],
          ['Maquinaria', equipo?.tipo],
          ['Fecha / Hora', `${fechaCorta(registro.fecha)} · ${registro.horaCarga} h`],
          ['Tipo de combustible', registro.tipoCombustible],
          ['Cantidad solicitada', `${numero(registro.litrosSolicitados, 2)} L`],
          ['Cantidad cargada', <strong>{numero(registro.litrosCargados, 2)} L</strong>],
        ]}
      />
      <SeccionConsulta
        titulo="Operación y responsables"
        datos={[
          ['Operador', registro.operador],
          ['Residente registrado en el suministro', registro.nombreResidente],
          ['PK registrado en el suministro', registro.pkResidente],
          ...(coincideConCaptura
            ? [['Asignación vigente desde', fechaAsignacion] as [string, string]]
            : []),
          ['N° de orquesta', registro.numeroOrquesta],
          ['Despachador', registro.nombreDespachador],
        ]}
      />
      {vigente && !coincideConCaptura && (
        <SeccionConsulta
          titulo="Asignación vigente de la maquinaria"
          datos={[
            ['Residente actual', vigente.nombre],
            ['PK actual', vigente.pk],
            ['Fecha de asignación', fechaAsignacion],
          ]}
        />
      )}
      {(registro.actividad || registro.responsableLegado) && (
        <details className="rounded border p-3 mb-3">
          <summary>Datos históricos del formato anterior</summary>
          <SeccionConsulta
            titulo="Información conservada del registro original"
            datos={[
              ...(registro.actividad
                ? [['Actividad anterior', registro.actividad] as [string, string]]
                : []),
              ...(registro.responsableLegado
                ? [['Responsable anterior', registro.responsableLegado] as [string, string]]
                : []),
            ]}
          />
        </details>
      )}
      <AuditoriaConsulta registro={registro} />
    </>
  );
}
