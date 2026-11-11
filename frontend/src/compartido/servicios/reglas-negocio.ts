import { hoy } from '../utilidades/formato';
import type { BaseDatos, MapaDatos, Modulo } from '../tipos/datos';
import { esquemasDatos } from '../validaciones/base-datos';
import { analizarSecuenciaHorometro } from '../utilidades/calculos';
export function validarRegistro<Clave extends Modulo>(
  modulo: Clave,
  datos: MapaDatos[Clave],
  id: string | undefined,
  base: BaseDatos,
): MapaDatos[Clave] {
  if (modulo === 'control-diario')
    throw new Error(
      'Control Diario es de solo consulta y reportes. Los registros se generan desde Horómetros y Combustible.',
    );
  const resultado = esquemasDatos[modulo].safeParse(datos);
  if (!resultado.success) throw new Error(resultado.error.issues[0].message);
  const validos = resultado.data;
  if ('fecha' in validos && validos.fecha > hoy())
    throw new Error('La fecha operativa no puede estar en el futuro.');
  if ('numeroEconomico' in validos) {
    if (
      validos.residenteId &&
      !base.catalogos?.some(
        (r) =>
          r.id === validos.residenteId &&
          r.tipo === 'residentes' &&
          (r.activo || base.maquinarias.find((m) => m.id === id)?.residenteId === r.id),
      )
    )
      throw new Error('Selecciona un residente válido del catálogo.');
    if (
      base.maquinarias.some(
        (equipo) =>
          equipo.id !== id &&
          equipo.numeroEconomico.toUpperCase() === validos.numeroEconomico.toUpperCase(),
      )
    )
      throw new Error('El número económico ya está registrado. Usa uno diferente.');
  }
  if (
    'maquinariaId' in validos &&
    !base.maquinarias.some((equipo) => equipo.id === validos.maquinariaId)
  )
    throw new Error('Selecciona una maquinaria registrada.');
  if (modulo === 'horometros' && 'lecturaInicial' in validos) {
    const otros = base.horometros.filter(
      (registro) =>
        !registro.eliminado && registro.id !== id && registro.maquinariaId === validos.maquinariaId,
    );
    if (
      otros.some(
        (registro) =>
          registro.fecha === validos.fecha &&
          registro.lecturaInicial === validos.lecturaInicial &&
          registro.lecturaFinal === validos.lecturaFinal,
      )
    )
      throw new Error('Ya existe esta lectura para el equipo y la fecha.');
    const mismoDia = otros.filter((registro) => registro.fecha === validos.fecha);
    if (
      mismoDia.some(
        (registro) =>
          validos.lecturaInicial < registro.lecturaFinal &&
          validos.lecturaFinal > registro.lecturaInicial,
      )
    )
      throw new Error(
        'Ya existe una lectura que se superpone con este intervalo. Edita el registro existente.',
      );
    if (
      mismoDia.reduce(
        (total, registro) => total + registro.lecturaFinal - registro.lecturaInicial,
        validos.lecturaFinal - validos.lecturaInicial,
      ) > 24
    )
      throw new Error('Las lecturas del equipo en el día no pueden sumar más de 24 horas.');
    if (
      otros.some(
        (registro) =>
          (registro.fecha < validos.fecha && registro.lecturaFinal > validos.lecturaInicial) ||
          (registro.fecha > validos.fecha && registro.lecturaInicial < validos.lecturaFinal),
      )
    )
      throw new Error(
        'Las lecturas no son consistentes con los registros anteriores o posteriores de este equipo.',
      );
    const maquinaria = base.maquinarias.find((equipo) => equipo.id === validos.maquinariaId)!;
    const secuencia = analizarSecuenciaHorometro(maquinaria, [
      ...otros,
      {
        ...validos,
        id: id ?? 'nueva-lectura',
        eliminado: false,
      } as (typeof base.horometros)[number],
    ]);
    if (secuencia.motivo) throw new Error(`No se puede guardar esta lectura: ${secuencia.motivo}`);
  }
  if (modulo === 'horometros' && id) {
    const anterior = base.horometros.find((registro) => registro.id === id);
    // Los campos retirados solo se conservan desde el registro anterior.
    for (const campo of ['actividad', 'frenteId', 'horaAsignacion'] as const)
      if (anterior?.[campo] !== undefined) Object.assign(validos, { [campo]: anterior[campo] });
  }
  return validos as MapaDatos[Clave];
}
