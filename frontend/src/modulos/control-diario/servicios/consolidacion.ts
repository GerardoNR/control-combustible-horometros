import { horometroActual } from '../../maquinarias/servicios/mantenimiento';
import { evaluarOperacion } from './alertas-maquinaria';
import { residentesOperacion } from './residentes-operacion';
import { evaluarConsumo } from './evaluacion-consumo';
import type { Auditoria, BaseDatos } from '../../../compartido/tipos/datos';
import type { Horometro } from '../../horometros/tipos/horometro';
import type { Suministro } from '../../combustible/tipos/suministro';
import type { OperacionConsolidada } from '../tipos/consolidado';
import { resumirFuentes } from '../../../compartido/utilidades/calculos';
export const identificadorDiario = (maquinariaId: string, fecha: string) =>
  `diario:${encodeURIComponent(maquinariaId)}:${fecha}`;
interface Grupo {
  maquinariaId: string;
  fecha: string;
  lecturas: Horometro[];
  cargas: Suministro[];
}
function auditoriaConsolidada(grupo: Grupo): Omit<Auditoria, 'id'> {
  const fuentes = [
    ...grupo.lecturas.map((registro) => ({ registro, origen: 'Horómetros' })),
    ...grupo.cargas.map((registro) => ({ registro, origen: 'Combustible' })),
  ];
  const ordenadas = [...fuentes].sort(
    (a, b) => Date.parse(a.registro.creadoEn) - Date.parse(b.registro.creadoEn),
  );
  const ultima = [...fuentes].sort(
    (a, b) => Date.parse(b.registro.modificadoEn) - Date.parse(a.registro.modificadoEn),
  )[0].registro;
  const primera = ordenadas[0].registro;
  return {
    creadoEn: primera.creadoEn,
    creadoPor: primera.creadoPor,
    modificadoEn: ultima.modificadoEn,
    modificadoPor: ultima.modificadoPor,
    historial: fuentes
      .flatMap(({ registro, origen }) =>
        registro.historial.map((cambio) => ({
          ...cambio,
          valores: { ...cambio.valores, origen, registroId: registro.id },
        })),
      )
      .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha)),
  };
}
export function consolidarControlDiario(base: BaseDatos): OperacionConsolidada[] {
  const grupos = new Map<string, Grupo>();
  function obtener(registro: { maquinariaId: string; fecha: string }) {
    const clave = identificadorDiario(registro.maquinariaId, registro.fecha);
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = {
        maquinariaId: registro.maquinariaId,
        fecha: registro.fecha,
        lecturas: [],
        cargas: [],
      };
      grupos.set(clave, grupo);
    }
    return grupo;
  }
  base.horometros
    .filter((registro) => !registro.eliminado)
    .forEach((registro) => obtener(registro));
  base.combustible
    .filter((registro) => !registro.eliminado)
    .forEach((registro) => obtener(registro));
  // Las fuentes eliminadas solo aportan historial a grupos que todavía existen.
  base.horometros.forEach((registro) =>
    grupos.get(identificadorDiario(registro.maquinariaId, registro.fecha))?.lecturas.push(registro),
  );
  base.combustible.forEach((registro) =>
    grupos.get(identificadorDiario(registro.maquinariaId, registro.fecha))?.cargas.push(registro),
  );
  const maquinarias = new Map(base.maquinarias.map((maquinaria) => [maquinaria.id, maquinaria]));
  const continuidad = new Map(
    base.maquinarias.map((equipo) => [equipo.id, horometroActual(equipo, base) !== null]),
  );
  return [...grupos.entries()]
    .map(([id, grupo]) => {
      const resumen = resumirFuentes(grupo.lecturas, grupo.cargas);
      const maquinaria = maquinarias.get(grupo.maquinariaId);
      const operadores = [
        ...new Set(
          [...grupo.lecturas, ...grupo.cargas]
            .filter((registro) => !registro.eliminado)
            .map((registro) => registro.operador.trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, 'es'));
      const operador = operadores.join(' / ');
      const fuentesVigentes = [...grupo.lecturas, ...grupo.cargas].filter(
        (registro) => !registro.eliminado,
      );
      const regimenes = new Set(fuentesVigentes.map((registro) => registro.regimenOperacion || ''));
      const regimenConsumo =
        regimenes.size === 1
          ? [...regimenes][0] || undefined
          : regimenes.size > 1
            ? 'Mixto'
            : undefined;
      const pendientes: string[] = [];
      if (!resumen.tieneHoras) pendientes.push('Falta horómetro');
      else if (!resumen.horasValidas) pendientes.push('Revisar lecturas');
      if (!resumen.tieneLitros) pendientes.push('Falta combustible');
      else if (!resumen.litrosValidos) pendientes.push('Revisar cargas');
      if (!operador) pendientes.push('Falta operador');
      if (!maquinaria) pendientes.push('Maquinaria no disponible');
      if (continuidad.get(grupo.maquinariaId) === false)
        pendientes.push('Revisar continuidad del horómetro');
      const registro: OperacionConsolidada = {
        id,
        regimenConsumo,
        fecha: grupo.fecha,
        maquinariaId: grupo.maquinariaId,
        numeroEconomico: maquinaria?.numeroEconomico ?? grupo.maquinariaId,
        maquinaria: maquinaria?.tipo ?? 'Maquinaria no disponible',
        operador,
        // Lecturas verificadas para el Excel; las horas siguen sumando periodos trabajados.
        lecturasHorometro:
          resumen.tieneHoras && resumen.horasValidas
            ? grupo.lecturas
                .filter((lectura) => !lectura.eliminado)
                .sort((a, b) => a.lecturaInicial - b.lecturaInicial)
                .map((lectura) => ({
                  inicial: lectura.lecturaInicial,
                  final: lectura.lecturaFinal,
                }))
            : [],
        ...residentesOperacion(maquinaria, grupo.fecha, base),
        estadoConsumo: evaluarConsumo(
          resumen.tieneHoras &&
            resumen.horasValidas &&
            continuidad.get(grupo.maquinariaId) !== false
            ? resumen.horas
            : null,
          resumen.tieneLitros && resumen.litrosValidos ? resumen.litros : null,
          maquinaria,
          regimenConsumo,
        ),
        horas: resumen.tieneHoras && resumen.horasValidas ? resumen.horas : null,
        litros: resumen.tieneLitros && resumen.litrosValidos ? resumen.litros : null,
        litrosHora: resumen.litrosHora,
        horasLitro: resumen.horasLitro,
        pendientes,
        ...auditoriaConsolidada(grupo),
      };
      return { ...registro, evaluacion: evaluarOperacion(registro, maquinaria) };
    })
    .sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) ||
        a.numeroEconomico.localeCompare(b.numeroEconomico, 'es') ||
        a.id.localeCompare(b.id),
    );
}
