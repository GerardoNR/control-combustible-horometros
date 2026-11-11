import type { Horometro } from '../tipos/horometro';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import {
  SeccionConsulta,
  AuditoriaConsulta,
} from '../../../compartido/componentes/ConsultaRegistro';
import { fechaCorta, numero } from '../../../compartido/utilidades/formato';
import { horasTrabajadas } from '../../../compartido/utilidades/calculos';
import { SeccionAsignaciones } from './SeccionAsignaciones';
export function DetallesHorometro({ registro }: { registro: Horometro }) {
  const { base } = useDatos();
  const equipo = base.maquinarias.find((equipo) => equipo.id === registro.maquinariaId);
  return (
    <>
      <section aria-label="Datos del horómetro">
        <SeccionConsulta
          titulo="Maquinaria y fecha"
          datos={[
            ['Número económico', equipo?.numeroEconomico ?? registro.maquinariaId],
            ['Maquinaria', equipo?.tipo],
            ['Fecha de registro', fechaCorta(registro.fecha)],
          ]}
        />
        <SeccionConsulta
          titulo="Lecturas y horas trabajadas"
          datos={[
            ['Horómetro inicial', `${numero(registro.lecturaInicial, 2)} h`],
            ['Horómetro final', `${numero(registro.lecturaFinal, 2)} h`],
            ['Horas trabajadas', <strong>{numero(horasTrabajadas(registro), 2)} h</strong>],
          ]}
        />
        <SeccionConsulta
          titulo="Operador y asignación"
          datos={[
            ['Operador asignado', registro.operador],
            [
              'Fecha de asignación del operador',
              registro.fechaAsignacion ? fechaCorta(registro.fechaAsignacion) : 'Sin registrar',
            ],
          ]}
        />
      </section>
      <details className="rounded border p-3 mb-3">
        <summary>Movimientos de operadores</summary>
        <SeccionAsignaciones
          key={registro.maquinariaId}
          maquinariaId={registro.maquinariaId}
        />
      </details>
      <AuditoriaConsulta
        registro={registro}
        camposOcultos={['actividad', 'frenteId', 'horaAsignacion', 'asignacionId']}
      />
    </>
  );
}
