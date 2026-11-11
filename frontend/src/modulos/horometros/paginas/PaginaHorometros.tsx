import { textoMaquinaria } from '../../../compartido/utilidades/texto-maquinaria';
import { DetallesHorometro } from '../componentes/DetallesHorometro';
import { useFiltrosPeriodo } from '../../../compartido/utilidades/useFiltrosPeriodo';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { CabeceraPagina } from '../../../compartido/componentes/CabeceraPagina';
import { Indicadores } from '../../../compartido/componentes/Indicadores';
import { GestorRegistros } from '../../../compartido/componentes/GestorRegistros';
import { FiltrosPeriodo } from '../../../compartido/componentes/Filtros';
import { DatosEquipo } from '../../../compartido/componentes/DatosEquipo';
import { horasTrabajadas } from '../../../compartido/utilidades/calculos';
import { fechaCorta, numero } from '../../../compartido/utilidades/formato';
import { FormularioHorometro } from '../formularios/FormularioHorometro';
import type { Columna } from '../../../compartido/componentes/TablaRegistros';
import type { Horometro } from '../tipos/horometro';
export function PaginaHorometros() {
  const { base } = useDatos();
  const filtros = useFiltrosPeriodo();
  const registros = base.horometros
    .filter(
      (registro) =>
        !registro.eliminado &&
        filtros.coincide(
          registro,
          `${textoMaquinaria(base, registro.maquinariaId)} ${registro.operador}`,
        ),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const columnas: Columna<Horometro>[] = [
    { titulo: 'Fecha', mostrar: (registro) => fechaCorta(registro.fecha) },
    {
      titulo: 'N° económico',
      mostrar: (registro) => <DatosEquipo id={registro.maquinariaId} campo="numeroEconomico" />,
    },
    {
      titulo: 'Maquinaria',
      mostrar: (registro) => <DatosEquipo id={registro.maquinariaId} campo="maquinaria" />,
    },
    {
      titulo: 'Horómetro inicial',
      mostrar: (registro) => `${numero(registro.lecturaInicial, 2)} h`,
    },
    { titulo: 'Horómetro final', mostrar: (registro) => `${numero(registro.lecturaFinal, 2)} h` },
    {
      titulo: 'Horas trabajadas',
      mostrar: (registro) => (
        <strong className="text-primary">{numero(horasTrabajadas(registro), 2)} h</strong>
      ),
    },
    { titulo: 'Operador', mostrar: (registro) => registro.operador },
  ];
  return (
    <>
      <CabeceraPagina
        titulo="Horómetros"
        descripcion="Registra las lecturas y da seguimiento a las horas de trabajo de tu maquinaria."
      />
      <Indicadores
        elementos={[
          {
            titulo: 'Horas trabajadas',
            valor: (
              <>
                {numero(
                  registros.reduce((total, registro) => total + horasTrabajadas(registro), 0),
                  2,
                )}{' '}
                <small>h</small>
              </>
            ),
            detalle: 'Total del periodo filtrado',
            icono: 'clock',
          },
          {
            titulo: 'Lecturas registradas',
            valor: registros.length,
            detalle: 'Registros que coinciden con los filtros',
            icono: 'speedometer2',
          },
          {
            titulo: 'Equipos con lectura',
            valor: new Set(registros.map((registro) => registro.maquinariaId)).size,
            detalle: 'Maquinarias en el periodo',
          },
          {
            titulo: 'Control de lecturas',
            valor: 'Automático',
            detalle: 'Horas = lectura final − inicial',
            icono: 'check2-circle',
            tono: 'verde',
          },
        ]}
      />
      <GestorRegistros
        modulo="horometros"
        titulo="Registro de horómetros"
        singular="horómetro"
        registros={registros}
        columnas={columnas}
        filtros={<FiltrosPeriodo filtros={filtros} />}
        contenidoConsulta={(registro) => <DetallesHorometro registro={registro} />}
        sinMaquinaria={!base.maquinarias.length}
        formulario={(registro, cancelar, exito) => (
          <FormularioHorometro registro={registro} cancelar={cancelar} exito={exito} />
        )}
      />
    </>
  );
}
