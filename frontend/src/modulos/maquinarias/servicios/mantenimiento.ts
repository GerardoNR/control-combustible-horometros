import type { BaseDatos, Usuario } from '../../../compartido/tipos/datos';
import type { Maquinaria } from '../tipos/maquinaria';
import type { DatosMantenimiento } from '../tipos/mantenimiento';
import { esquemaMantenimiento } from '../validaciones/mantenimiento';
import { exigirEscritura } from '../../acceso/servicios/permisos';
import { hoy } from '../../../compartido/utilidades/formato';
import { analizarSecuenciaHorometro, redondear } from '../../../compartido/utilidades/calculos';

export function sumarDiasCalendario(fecha: string, dias: number): string {
  const instante = new Date(`${fecha}T00:00:00Z`);
  instante.setUTCDate(instante.getUTCDate() + dias);
  return instante.toISOString().slice(0, 10);
}
function analizarHorometro(maquinaria: Maquinaria, base: BaseDatos) {
  return analizarSecuenciaHorometro(maquinaria, base.horometros);
}
export function horometroActual(maquinaria: Maquinaria, base: BaseDatos) {
  return analizarHorometro(maquinaria, base).actual;
}

export function serviciosMaquinaria(base: BaseDatos, maquinariaId: string) {
  return (base.mantenimientos ?? [])
    .filter((r) => !r.eliminado && r.maquinariaId === maquinariaId)
    .sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) ||
        b.lecturaHorometro - a.lecturaHorometro ||
        b.creadoEn.localeCompare(a.creadoEn),
    );
}
function estadoMantenimiento(horas: number | null, aviso: number, limite: number) {
  if (horas === null)
    return { estado: 'Avance pendiente de verificar', tono: 'secundario' } as const;
  if (horas > limite) return { estado: 'Vencido', tono: 'rojo' } as const;
  if (horas >= aviso) return { estado: 'Próximo', tono: 'amarillo' } as const;
  return { estado: 'En rango', tono: 'verde' } as const;
}

export function evaluarMantenimiento(maquinaria: Maquinaria, base: BaseDatos) {
  const servicio = serviciosMaquinaria(base, maquinaria.id)[0];
  const secuencia = analizarHorometro(maquinaria, base);
  const actual = secuencia.actual;
  const aviso = maquinaria.avisoMantenimientoHoras ?? 200;
  const limite = maquinaria.limiteMantenimientoHoras ?? 250;
  const inicioIntervalo =
    servicio && Number.isFinite(servicio.lecturaHorometro) && servicio.lecturaHorometro >= 0
      ? servicio.lecturaHorometro
      : null;
  const inconsistente =
    actual === null ||
    (servicio && inicioIntervalo === null) ||
    (inicioIntervalo !== null && actual !== null && actual < inicioIntervalo);
  const motivoRevision =
    secuencia.motivo ??
    (inicioIntervalo !== null && actual !== null && actual < inicioIntervalo
      ? `El horómetro actual (${actual} h) es menor que la referencia del último servicio (${inicioIntervalo} h). Verifica si hubo reinicio, sustitución o corrección documentada antes de calcular el avance.`
      : servicio && inicioIntervalo === null
        ? 'La referencia del último servicio no es válida.'
        : null);
  const horas =
    !inconsistente && secuencia.ultimaLectura !== undefined && inicioIntervalo !== null
      ? redondear(actual - inicioIntervalo)
      : null;
  const estado = inconsistente
    ? ({ estado: 'Revisar horómetro', tono: 'secundario' } as const)
    : !servicio
      ? ({ estado: 'Sin mantenimiento de referencia', tono: 'secundario' } as const)
      : estadoMantenimiento(horas, aviso, limite);
  const limiteRestante = horas === null ? null : Math.max(0, redondear(limite - horas));
  return {
    ...estado,
    motivoRevision,
    servicio,
    actual,
    horas,
    inicioIntervalo,
    aviso,
    limite,
    objetivoAviso: inicioIntervalo === null ? null : redondear(inicioIntervalo + aviso),
    objetivo: inicioIntervalo === null ? null : redondear(inicioIntervalo + limite),
    avisoRestante: horas === null ? null : Math.max(0, redondear(aviso - horas)),
    limiteRestante,
    restantes: limiteRestante,
    excedidas: horas === null ? null : Math.max(0, redondear(horas - limite)),
    progreso: horas === null ? null : Math.min(100, (horas / limite) * 100),
  };
}

export type ResumenMantenimiento = ReturnType<typeof evaluarMantenimiento>;
export function validarMantenimiento(datos: DatosMantenimiento, base: BaseDatos, usuario: Usuario) {
  exigirEscritura(usuario, 'maquinarias');
  const validos = esquemaMantenimiento.parse(datos);
  const maquinaria = base.maquinarias.find((r) => r.id === validos.maquinariaId && !r.eliminado);
  if (!maquinaria) throw new Error('Selecciona una maquinaria registrada.');
  if (validos.fecha > hoy()) throw new Error('El servicio no puede estar en el futuro.');
  const actual = horometroActual(maquinaria, base);
  if (actual === null)
    throw new Error('Revisa las lecturas: posible reinicio o sustitución del horómetro.');
  if (validos.lecturaHorometro > actual)
    throw new Error('La lectura del servicio no puede superar el horómetro actual.');
  const anterior = serviciosMaquinaria(base, maquinaria.id)[0];
  if (
    anterior &&
    (validos.fecha < anterior.fecha || validos.lecturaHorometro < anterior.lecturaHorometro)
  )
    throw new Error('El servicio debe ser posterior o igual a la referencia vigente.');
  const lecturas = base.horometros.filter((r) => !r.eliminado && r.maquinariaId === maquinaria.id);
  if (
    lecturas.some(
      (r) =>
        (r.fecha < validos.fecha && r.lecturaFinal > validos.lecturaHorometro) ||
        (r.fecha > validos.fecha && r.lecturaInicial < validos.lecturaHorometro),
    )
  )
    throw new Error(
      'La lectura no corresponde a las lecturas anteriores o posteriores a la fecha del servicio.',
    );
  if (
    (base.mantenimientos ?? []).some(
      (r) =>
        r.maquinariaId === validos.maquinariaId &&
        r.fecha === validos.fecha &&
        r.lecturaHorometro === validos.lecturaHorometro &&
        r.tipoServicio.toLocaleLowerCase('es') === validos.tipoServicio.toLocaleLowerCase('es'),
    )
  )
    throw new Error('Este servicio ya está registrado.');
  return validos;
}
export function crearMantenimiento(datos: DatosMantenimiento, base: BaseDatos, usuario: Usuario) {
  const validos = validarMantenimiento(datos, base, usuario);
  const fecha = new Date().toISOString();
  return {
    ...validos,
    id: crypto.randomUUID(),
    creadoEn: fecha,
    modificadoEn: fecha,
    creadoPor: usuario.nombre,
    modificadoPor: usuario.nombre,
    historial: [
      {
        fecha,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'Creación' as const,
        valores: { ...validos, observaciones: validos.observaciones ?? '' },
      },
    ],
  };
}
