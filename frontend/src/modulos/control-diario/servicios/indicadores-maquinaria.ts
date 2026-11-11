import { esquemaConfiguracionConsumo } from '../../maquinarias/validaciones/consumo';
import type { BaseDatos } from '../../../compartido/tipos/datos';
import { evaluarMantenimiento } from '../../maquinarias/servicios/mantenimiento';
import { evaluarConsumo } from './evaluacion-consumo';
import type { FiltrosControl, OperacionConsolidada } from '../tipos/consolidado';
import type { IndicadorMaquinaria } from '../tipos/indicadores-maquinaria';

export function crearIndicadoresMaquinaria(
  base: BaseDatos,
  operaciones: OperacionConsolidada[],
  filtros: FiltrosControl,
  horasMinimasDiarias?: number,
): IndicadorMaquinaria[] {
  return base.maquinarias
    .filter((maquinaria) => !maquinaria.eliminado)
    .filter((maquinaria) => !filtros.maquinaria || maquinaria.id === filtros.maquinaria)
    .flatMap((maquinaria) => {
      const registros = operaciones.filter((operacion) => operacion.maquinariaId === maquinaria.id);
      if (filtros.operador && !registros.length) return [];
      const textoEquipo = `${maquinaria.numeroEconomico} ${maquinaria.tipo}`.toLocaleLowerCase(
        'es',
      );
      if (
        filtros.busqueda &&
        !registros.length &&
        !textoEquipo.includes(filtros.busqueda.toLocaleLowerCase('es'))
      )
        return [];
      const horasValidas = registros.flatMap((registro) =>
        registro.horas !== null && Number.isFinite(registro.horas) && registro.horas >= 0
          ? [registro.horas]
          : [],
      );
      const litrosValidos = registros.flatMap((registro) =>
        registro.litros !== null && Number.isFinite(registro.litros) && registro.litros >= 0
          ? [registro.litros]
          : [],
      );
      const pares = registros.filter(
        (registro) =>
          registro.horas !== null &&
          registro.horas > 0 &&
          registro.litros !== null &&
          registro.litros >= 0 &&
          !registro.pendientes.some((motivo) =>
            /Revisar (lecturas|cargas|continuidad)/.test(motivo),
          ),
      );
      const horas = horasValidas.length
        ? horasValidas.reduce((suma, valor) => suma + valor, 0)
        : null;
      const litros = litrosValidos.length
        ? litrosValidos.reduce((suma, valor) => suma + valor, 0)
        : null;
      const horasPares = pares.reduce((suma, registro) => suma + registro.horas!, 0);
      const litrosPares = pares.reduce((suma, registro) => suma + registro.litros!, 0);
      const rendimiento = horasPares > 0 ? litrosPares / horasPares : null;
      const mantenimientoActual = evaluarMantenimiento(maquinaria, base);
      const mantenimiento: IndicadorMaquinaria['mantenimiento'] =
        mantenimientoActual.estado === 'Sin mantenimiento de referencia'
          ? 'Sin referencia'
          : (
              {
                'Revisar horómetro': 'Revisar horómetro',
                'Avance pendiente de verificar': 'Avance pendiente de verificar',
                'En rango': 'Verde',
                Próximo: 'Amarillo',
                Vencido: 'Rojo',
              } as const
            )[mantenimientoActual.estado];
      const diasOperativos = new Set(
        registros
          .filter((registro) => registro.horas !== null && registro.horas >= 0)
          .map((registro) => registro.fecha),
      ).size;
      const configuracion = esquemaConfiguracionConsumo.safeParse(maquinaria);
      const umbral =
        (configuracion.success ? configuracion.data.horasMinimasDiarias : undefined) ??
        horasMinimasDiarias;
      const regimenes = new Set(pares.map((registro) => registro.regimenConsumo || ''));
      const regimen = regimenes.size === 1 ? [...regimenes][0] || undefined : 'Mixto';
      const actividad =
        maquinaria.estado !== 'Operativa'
          ? 'No aplica'
          : !registros.length
            ? 'Sin registros'
            : horasValidas.length !== registros.length ||
                umbral === undefined ||
                !Number.isFinite(umbral) ||
                umbral <= 0
              ? 'Sin datos suficientes'
              : diasOperativos > 0 && (horas ?? 0) / diasOperativos < umbral
                ? 'Pocas horas'
                : 'Normal';
      const consumo = evaluarConsumo(horasPares || null, litrosPares, maquinaria, regimen);
      const maximoComparable =
        regimen === 'Ralentí' ? maquinaria.consumoRalentiMaximo : maquinaria.consumoNormalMaximo;
      return [
        {
          maquinariaId: maquinaria.id,
          numeroEconomico: maquinaria.numeroEconomico,
          maquinaria: maquinaria.tipo,
          estadoOperativo: maquinaria.estado,
          mantenimiento,
          horas,
          litros,
          rendimiento,
          consumo,
          actividad,
          desviacionConsumo:
            consumo !== 'Sin evaluar' &&
            rendimiento !== null &&
            maximoComparable !== undefined &&
            maximoComparable > 0
              ? rendimiento / maximoComparable
              : null,
          diasOperativos,
        } satisfies IndicadorMaquinaria,
      ];
    })
    .sort((a, b) => a.numeroEconomico.localeCompare(b.numeroEconomico, 'es'));
}
