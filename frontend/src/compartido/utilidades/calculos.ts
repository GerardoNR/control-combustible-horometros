import type { BaseDatos } from '../tipos/datos';
import type { Horometro } from '../../modulos/horometros/tipos/horometro';
import type { Maquinaria } from '../../modulos/maquinarias/tipos/maquinaria';
import type { Suministro } from '../../modulos/combustible/tipos/suministro';
export const horasTrabajadas = (registro: Pick<Horometro, 'lecturaInicial' | 'lecturaFinal'>) =>
  redondear(registro.lecturaFinal - registro.lecturaInicial);
export const redondear = (valor: number) => Math.round((valor + Number.EPSILON) * 1000) / 1000;
export function analizarSecuenciaHorometro(
  maquinaria: Maquinaria,
  lecturas: Horometro[],
  hastaFecha?: string,
) {
  let actual = maquinaria.horometroBase;
  let ultimaLectura: Horometro | undefined;
  const horasPorDia = new Map<string, number>();
  const ordenadas = lecturas
    .filter(
      (lectura) =>
        !lectura.eliminado &&
        lectura.maquinariaId === maquinaria.id &&
        (!hastaFecha || lectura.fecha <= hastaFecha),
    )
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.lecturaInicial - b.lecturaInicial ||
        a.lecturaFinal - b.lecturaFinal ||
        a.id.localeCompare(b.id),
    );
  if (!Number.isFinite(actual) || actual < 0)
    return { actual: null, ultimaLectura, motivo: 'La lectura base no es válida.' };
  for (const lectura of ordenadas) {
    if (
      !Number.isFinite(lectura.lecturaInicial) ||
      !Number.isFinite(lectura.lecturaFinal) ||
      lectura.lecturaInicial < actual ||
      lectura.lecturaFinal < lectura.lecturaInicial
    )
      return {
        actual: null,
        ultimaLectura,
        motivo: `La lectura del ${lectura.fecha} no continúa desde el horómetro anterior. Verifica si hubo reinicio, sustitución o corrección documentada.`,
      };
    const horas = horasTrabajadas(lectura);
    const acumuladas = (horasPorDia.get(lectura.fecha) ?? 0) + horas;
    if (horas > 24 || acumuladas > 24)
      return {
        actual: null,
        ultimaLectura,
        motivo: `Las lecturas del ${lectura.fecha} exceden 24 horas trabajadas. Revisa sus intervalos.`,
      };
    horasPorDia.set(lectura.fecha, acumuladas);
    actual = lectura.lecturaFinal;
    ultimaLectura = lectura;
  }
  return { actual, ultimaLectura, motivo: null };
}
export const ultimoHorometro = (maquinaria: Maquinaria, lecturas: Horometro[]) =>
  analizarSecuenciaHorometro(maquinaria, lecturas).actual;
export function calcularRendimientos(horas: number | null, litros: number | null) {
  const validos =
    horas !== null &&
    litros !== null &&
    Number.isFinite(horas) &&
    Number.isFinite(litros) &&
    horas > 0 &&
    litros >= 0;
  return {
    litrosHora: validos ? litros / horas : null,
    horasLitro: validos && litros > 0 ? horas / litros : null,
  };
}
export function resumirFuentes(lecturas: Horometro[], suministros: Suministro[]) {
  const activas = lecturas.filter((registro) => !registro.eliminado);
  const cargas = suministros.filter((registro) => !registro.eliminado);
  const ordenadas = [...activas].sort((a, b) => a.lecturaInicial - b.lecturaInicial);
  const horas = redondear(
    activas.reduce((total, registro) => total + horasTrabajadas(registro), 0),
  );
  const litros = redondear(cargas.reduce((total, registro) => total + registro.litrosCargados, 0));
  const horasValidas =
    activas.every(
      (registro) =>
        Number.isFinite(registro.lecturaInicial) &&
        Number.isFinite(registro.lecturaFinal) &&
        registro.lecturaInicial >= 0 &&
        registro.lecturaFinal >= registro.lecturaInicial,
    ) &&
    horas <= 24 &&
    Number.isFinite(horas) &&
    !ordenadas.some(
      (registro, indice) =>
        indice > 0 && registro.lecturaInicial < ordenadas[indice - 1].lecturaFinal,
    );
  const litrosValidos =
    cargas.every(
      (registro) => Number.isFinite(registro.litrosCargados) && registro.litrosCargados >= 0,
    ) && Number.isFinite(litros);
  const rendimientos = calcularRendimientos(
    activas.length && horasValidas ? horas : null,
    cargas.length && litrosValidos ? litros : null,
  );
  return {
    horas,
    litros,
    horasValidas,
    litrosValidos,
    tieneHoras: activas.length > 0,
    tieneLitros: cargas.length > 0,
    ...rendimientos,
    rendimiento: rendimientos.horasLitro,
  };
}
export function resumenDiario(base: BaseDatos, maquinariaId: string, fecha: string) {
  return resumirFuentes(
    base.horometros.filter(
      (registro) => registro.maquinariaId === maquinariaId && registro.fecha === fecha,
    ),
    base.combustible.filter(
      (registro) => registro.maquinariaId === maquinariaId && registro.fecha === fecha,
    ),
  );
}
