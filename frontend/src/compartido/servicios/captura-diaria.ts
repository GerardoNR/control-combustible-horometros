import type { BaseDatos } from '../tipos/datos';
import { analizarSecuenciaHorometro } from '../utilidades/calculos';
export function lecturaAnterior(
  base: BaseDatos,
  maquinariaId: string,
  fecha: string,
  excluirId?: string,
) {
  const maquinaria = base.maquinarias.find((equipo) => equipo.id === maquinariaId);
  if (!maquinaria) return undefined;
  const secuencia = analizarSecuenciaHorometro(
    maquinaria,
    base.horometros.filter((lectura) => lectura.id !== excluirId),
    fecha,
  );
  return secuencia.motivo ? undefined : secuencia.ultimaLectura;
}
export function asignacionParaFecha(
  base: BaseDatos,
  maquinariaId: string,
  fecha: string,
  hora?: string,
) {
  const inicio = new Date(`${fecha}T${hora || '00:00'}:00`).getTime();
  const fin = hora ? inicio + 1 : new Date(`${fecha}T23:59:59.999`).getTime();
  const candidatas = (base.asignacionesOperadores ?? []).filter(
    (asignacion) =>
      asignacion.maquinariaId === maquinariaId &&
      Date.parse(asignacion.inicio) <= fin &&
      (asignacion.fin === null || Date.parse(asignacion.fin) > inicio),
  );
  // Si hubo varios operadores en el día, la captura debe identificar el periodo.
  return candidatas.length === 1 ? candidatas[0] : undefined;
}

export function validarCapturaInicial(
  base: BaseDatos,
  datos: { maquinariaId: string; fecha: string; capturaInicialSupervisada?: string },
  rol: string,
  id?: string,
) {
  if (id || lecturaAnterior(base, datos.maquinariaId, datos.fecha)) return;
  if (rol !== 'ADMINISTRADOR' || datos.capturaInicialSupervisada !== 'Confirmada por administrador')
    throw new Error(
      'La primera lectura debe ser confirmada por un administrador como captura inicial supervisada.',
    );
}

export function referenciaAsignacion(
  base: BaseDatos,
  datos: { maquinariaId: string; fecha: string; operador: string; horaCarga?: string },
  anterior?: {
    maquinariaId: string;
    fecha: string;
    operador: string;
    asignacionId?: string;
    horaCarga?: string;
  },
) {
  if (
    anterior &&
    anterior.maquinariaId === datos.maquinariaId &&
    anterior.fecha === datos.fecha &&
    anterior.operador === datos.operador &&
    anterior.horaCarga === datos.horaCarga
  )
    return anterior.asignacionId;
  const asignacion = asignacionParaFecha(base, datos.maquinariaId, datos.fecha, datos.horaCarga);
  return asignacion?.operador === datos.operador ? asignacion.id : undefined;
}
