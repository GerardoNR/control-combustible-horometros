import type { OperacionConsolidada, TotalesControl } from '../tipos/consolidado';
import { calcularRendimientos, redondear } from '../../../compartido/utilidades/calculos';
export function totalizarControl(registros: OperacionConsolidada[]): TotalesControl {
  const horas = redondear(registros.reduce((total, registro) => total + (registro.horas ?? 0), 0));
  const litros = redondear(
    registros.reduce((total, registro) => total + (registro.litros ?? 0), 0),
  );
  const correspondientes = registros.filter(
    (registro) =>
      registro.horas !== null &&
      Number.isFinite(registro.horas) &&
      registro.horas > 0 &&
      registro.litros !== null &&
      Number.isFinite(registro.litros) &&
      registro.litros >= 0,
  );
  const horasValidas = correspondientes.reduce((suma, registro) => suma + registro.horas!, 0);
  const litrosValidos = correspondientes.reduce((suma, registro) => suma + registro.litros!, 0);
  return {
    registros: registros.length,
    parciales: registros.filter((registro) => registro.horas === null || registro.litros === null)
      .length,
    horas,
    litros,
    ...calcularRendimientos(horasValidas, litrosValidos),
  };
}
export function totalesPorMaquinaria(registros: OperacionConsolidada[]) {
  const grupos = new Map<string, OperacionConsolidada[]>();
  registros.forEach((registro) => {
    const grupo = grupos.get(registro.maquinariaId) ?? [];
    grupo.push(registro);
    grupos.set(registro.maquinariaId, grupo);
  });
  return [...grupos.entries()].map(([maquinariaId, grupo]) => ({
    maquinariaId,
    numeroEconomico: grupo[0].numeroEconomico,
    maquinaria: grupo[0].maquinaria,
    totales: totalizarControl(grupo),
  }));
}
