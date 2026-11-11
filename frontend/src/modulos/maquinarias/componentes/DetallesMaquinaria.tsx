import { SeccionConsulta as Tarjeta } from '../../../compartido/componentes/ConsultaRegistro';
import { ActividadMaquinaria } from './ActividadMaquinaria';
import { FichaMantenimiento } from './MantenimientoMaquinaria';
import { HistorialConsultaMaquinaria } from './HistorialConsultaMaquinaria';
import { Tab, Tabs } from 'react-bootstrap';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { numero, fechaHora, fechaCorta } from '../../../compartido/utilidades/formato';
import { EstadoMaquinaria } from '../../../compartido/componentes/DatosEquipo';
import { operadorEnInstante, residenteMaquinaria } from '../servicios/responsables';
import { evaluarMantenimiento } from '../servicios/mantenimiento';
import type { Maquinaria } from '../tipos/maquinaria';
import estilos from './DetallesMaquinaria.module.css';
export function DetallesMaquinaria({ registro }: { registro: Maquinaria }) {
  const { base } = useDatos();
  const asignacion = operadorEnInstante(base, registro.id);
  const residente = residenteMaquinaria(base, registro);
  const mantenimiento = evaluarMantenimiento(registro, base);
  return (
    <div className={estilos.consulta}>
      <Tabs
        id="consulta-maquinaria"
        defaultActiveKey="general"
        transition={false}
        mountOnEnter={false}
        unmountOnExit={false}
        className={estilos.pestanas}
      >
        <Tab eventKey="general" title="General" className={estilos.panel} tabIndex={0}>
          <div className={estilos.general}>
            <Tarjeta
              titulo="Información general"
              datos={[
                [
                  'Número económico',
                  <strong className={estilos.destacado}>{registro.numeroEconomico}</strong>,
                ],
                ['Maquinaria', registro.tipo],
                ['Marca', registro.marca],
                ['Modelo', registro.modelo],
                ['Placas', registro.placas],
              ]}
            />
            <Tarjeta
              titulo="Estado del equipo"
              datos={[['Estado', <EstadoMaquinaria estado={registro.estado} />]]}
            />
          </div>
          <FichaMantenimiento resumen={mantenimiento} />
          <ActividadMaquinaria maquinariaId={registro.id} />
          <details className="rounded border p-3 mb-3">
            <summary>Límites de consumo</summary>
            <Tarjeta
              titulo="Referencia operativa"
              datos={[
                [
                  'Mínimo esperado',
                  registro.consumoMinimoEsperado === undefined
                    ? 'Sin configurar'
                    : `${numero(registro.consumoMinimoEsperado, 2)} L/h`,
                ],
                [
                  'Advertencia inferior',
                  registro.consumoAdvertenciaMinimo === undefined
                    ? 'Sin configurar'
                    : `${numero(registro.consumoAdvertenciaMinimo, 2)} L/h`,
                ],
                [
                  'Jornada mínima por día operativo',
                  registro.horasMinimasDiarias === undefined
                    ? 'Sin configurar'
                    : `${numero(registro.horasMinimasDiarias, 2)} h`,
                ],
                [
                  'Rango de ralentí',
                  registro.consumoRalentiMinimo === undefined ||
                  registro.consumoRalentiMaximo === undefined
                    ? 'Sin configurar'
                    : `${numero(registro.consumoRalentiMinimo, 2)} a ${numero(registro.consumoRalentiMaximo, 2)} L/h`,
                ],
                [
                  'Advertencia de ralentí',
                  registro.consumoRalentiAdvertenciaMaximo === undefined
                    ? 'Sin configurar'
                    : `${numero(registro.consumoRalentiAdvertenciaMaximo, 2)} L/h`,
                ],
                [
                  'Máximo normal',
                  registro.consumoNormalMaximo === undefined
                    ? 'Sin configurar'
                    : `${numero(registro.consumoNormalMaximo, 2)} L/h`,
                ],
                [
                  'Máximo de advertencia',
                  registro.consumoAdvertenciaMaximo === undefined
                    ? 'Sin configurar'
                    : `${numero(registro.consumoAdvertenciaMaximo, 2)} L/h`,
                ],
                ['Referencia validada', registro.referenciaConsumo],
                ['Validado por', registro.validadoConsumoPor],
                [
                  'Fecha de validación',
                  registro.fechaValidacionConsumo
                    ? fechaCorta(registro.fechaValidacionConsumo)
                    : 'Sin registrar',
                ],
              ]}
            />
          </details>
        </Tab>
        <Tab eventKey="responsables" title="Responsables" className={estilos.panel} tabIndex={0}>
          <Tarjeta
            titulo="Responsables actuales"
            datos={[
              ['Operador actual', <strong>{asignacion?.operador ?? 'Sin asignar'}</strong>],
              [
                'Fecha de asignación del operador',
                asignacion ? fechaHora(asignacion.inicio) : 'Sin asignar',
              ],
              ['Residente actual', <strong>{residente?.nombre ?? 'Sin asignar'}</strong>],
              ['PK actual', <strong>{residente?.pk || 'Sin asignar'}</strong>],
              [
                'Fecha de asignación del residente',
                residente?.inicio ? fechaHora(residente.inicio) : 'Sin periodo registrado',
              ],
            ]}
          />
        </Tab>
        <Tab
          eventKey="historial"
          title="Historial"
          className={estilos.panel}
          tabIndex={0}
          data-historial-maquinaria
        >
          <HistorialConsultaMaquinaria registro={registro} />
        </Tab>
      </Tabs>
    </div>
  );
}
