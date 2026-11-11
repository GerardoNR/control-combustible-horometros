import type { ReactNode } from 'react';
import { fechaDelInstante } from '../utilidades/fecha-historial';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import {
  cambiosRelevantes,
  etiquetaHistorial,
  fechaHistorial,
  valorHistorial,
} from '../../../compartido/utilidades/presentacion-historial';
import type { Maquinaria } from '../tipos/maquinaria';
import { LineaTiempo } from './LineaTiempo';
import type { EventoConsulta } from './LineaTiempo';
export function HistorialMaquinaria({
  maquinaria,
  recientesPrimero = false,
  soloFechas = false,
}: {
  maquinaria: Maquinaria;
  recientesPrimero?: boolean;
  soloFechas?: boolean;
}) {
  const { base } = useDatos();
  const mostrarFecha = soloFechas ? fechaDelInstante : fechaHistorial;
  function presentar(campo: string, valor: string | number, instante: string) {
    if (valor === '') return campo === 'residenteId' ? 'Sin asignar' : 'Sin registrar';
    if (campo === 'residenteId') {
      return (
        [...(maquinaria.periodosResidentes ?? [])]
          .filter((p) => p.residenteId === valor && Date.parse(p.inicio) <= Date.parse(instante))
          .sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio))[0]?.nombre ??
        'Residente sin nombre histórico registrado'
      );
    }
    return valorHistorial(campo, valor, base);
  }
  const eventos: (EventoConsulta & { instante: string })[] = maquinaria.historial.map(
    (cambio, indice) => {
      const residente =
        Object.hasOwn(cambio.valores, 'residenteId') &&
        (cambio.valores.residenteId !== cambio.anteriores?.residenteId ||
          cambio.valores.motivoCambioResidente !== cambio.anteriores?.motivoCambioResidente);
      return {
        id: `registro-${indice}`,
        instante: cambio.fecha,
        titulo: residente && cambio.accion !== 'Creación' ? 'Cambio de residente' : cambio.accion,
        periodo: mostrarFecha(cambio.fecha),
        datos: [
          ['Usuario', cambio.usuarioNombre],
          ...cambiosRelevantes(cambio.valores, cambio.anteriores).map(
            ([campo, valor]): [string, ReactNode] => [
              etiquetaHistorial(campo),
              cambio.anteriores && cambio.anteriores[campo] !== undefined ? (
                <>
                  <span className="d-block text-secondary">
                    Anterior: {presentar(campo, cambio.anteriores[campo], cambio.fecha)}
                  </span>
                  <span className="d-block">
                    Nuevo: <strong>{presentar(campo, valor, cambio.fecha)}</strong>
                  </span>
                </>
              ) : (
                presentar(campo, valor, cambio.fecha)
              ),
            ],
          ),
        ],
      };
    },
  );
  eventos.sort((a, b) =>
    recientesPrimero
      ? Date.parse(b.instante) - Date.parse(a.instante)
      : Date.parse(a.instante) - Date.parse(b.instante),
  );
  return (
    <LineaTiempo
      eventos={eventos}
      vacio="Sin movimientos registrados"
      etiqueta="Historial de modificaciones de maquinaria"
    />
  );
}
