import type { BaseDatos } from '../tipos/datos';
import { numero } from './formato';

const etiquetas: Record<string, string> = {
  maquinariaId: 'Maquinaria',
  consumoMinimoEsperado: 'Mínimo esperado de consumo',
  consumoAdvertenciaMinimo: 'Advertencia de consumo bajo',
  consumoRalentiMinimo: 'Mínimo en ralentí',
  consumoRalentiMaximo: 'Máximo en ralentí',
  consumoRalentiAdvertenciaMaximo: 'Umbral crítico en ralentí',
  horasMinimasDiarias: 'Horas mínimas por día operativo',
  regimenOperacion: 'Régimen de operación',
  consumoNormalMaximo: 'Máximo normal de consumo',
  consumoAdvertenciaMaximo: 'Máximo de advertencia de consumo',
  referenciaConsumo: 'Referencia operativa validada',
  validadoConsumoPor: 'Consumo validado por',
  fechaValidacionConsumo: 'Fecha de validación de consumo',
  tipoId: 'Tipo de maquinaria de catálogo',
  marcaId: 'Marca de catálogo',
  modeloId: 'Modelo de catálogo',
  tipoCombustibleId: 'Combustible de catálogo',
  ubicacionId: 'Ubicación de catálogo',
  ubicacionResidenteId: 'Ubicación del responsable',
  ubicacionResidente: 'PK / Ubicación',
  numeroEconomico: 'Número económico',
  tipo: 'Maquinaria',
  horometroBase: 'Horómetro base',
  lecturaInicial: 'Lectura inicial',
  lecturaFinal: 'Lectura final',
  lecturaHorometro: 'Horómetro del servicio',
  tipoServicio: 'Tipo de servicio',
  avisoMantenimientoHoras: 'Aviso de mantenimiento',
  limiteMantenimientoHoras: 'Límite de mantenimiento',
  fechaUltimoMantenimiento: 'Último mantenimiento',
  fechaProximoMantenimiento: 'Programación anterior de mantenimiento',
  observacionesMantenimiento: 'Observaciones de mantenimiento',
  operadorId: 'Operador de catálogo',
  residenteId: 'Residente responsable',
  despachadorId: 'Despachador de catálogo',
  frenteId: 'Frente anterior de catálogo',
  asignacionId: 'Asignación de operador',
  registroId: 'Registro de origen',
  litrosSolicitados: 'Cantidad solicitada',
  litrosCargados: 'Cantidad cargada',
  tipoCombustible: 'Tipo de combustible',
  horaCarga: 'Hora de suministro',
  nombreResidente: 'Nombre del residente',
  pkResidente: 'PK / Ubicación',
  numeroOrquesta: 'Número de orquesta',
  nombreDespachador: 'Nombre del despachador',
  actividad: 'Actividad registrada',
  ingeniero: 'Responsable del formato anterior',
  responsableLegado: 'Responsable del formato anterior',
  origen: 'Módulo de origen',
  motivoCambioResidente: 'Motivo del cambio de residente',
  capturaInicialSupervisada: 'Confirmación de lectura inicial',
  muestra: 'Información de prueba',
};
export const etiquetaHistorial = (campo: string) =>
  etiquetas[campo] ??
  campo
    .replace(/([A-Z])/g, ' $1')
    .toLocaleLowerCase('es')
    .replace(/^./, (letra) => letra.toUpperCase());

export function fechaHistorial(valor: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.split('-').reverse().join('/');
  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime())) return 'Sin fecha registrada';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(fecha);
}
const camposHoras = new Set([
  'horasMinimasDiarias',
  'horometroBase',
  'lecturaInicial',
  'lecturaFinal',
  'lecturaHorometro',
  'avisoMantenimientoHoras',
  'limiteMantenimientoHoras',
]);
export function valorHistorial(
  campo: string,
  valor: string | number | undefined,
  base: BaseDatos,
): string {
  if (valor === undefined || valor === '') return 'Sin registrar';
  if (campo === 'maquinariaId') {
    const equipo = base.maquinarias.find((registro) => registro.id === valor);
    return equipo
      ? `${equipo.numeroEconomico} · ${equipo.tipo}`
      : 'Maquinaria sin referencia disponible';
  }
  if (
    [
      'operadorId',
      'residenteId',
      'despachadorId',
      'frenteId',
      'tipoId',
      'marcaId',
      'modeloId',
      'tipoCombustibleId',
      'ubicacionId',
      'ubicacionResidenteId',
    ].includes(campo)
  ) {
    return (
      base.catalogos?.find((entrada) => entrada.id === valor)?.nombre ??
      'Referencia histórica sin nombre disponible'
    );
  }
  if (campo === 'asignacionId') {
    const periodo = base.asignacionesOperadores?.find((entrada) => entrada.id === valor);
    return periodo
      ? `${periodo.operador} · Desde ${fechaHistorial(periodo.inicio)}`
      : 'Asignación histórica sin detalle disponible';
  }
  if (campo === 'registroId') {
    const registro = [...base.horometros, ...base.combustible].find(
      (entrada) => entrada.id === valor,
    );
    return registro
      ? `${valorHistorial('maquinariaId', registro.maquinariaId, base)} · ${fechaHistorial(registro.fecha)}`
      : 'Registro de origen sin detalle disponible';
  }
  if (campo.startsWith('fecha') && /^\d{4}-\d{2}-\d{2}/.test(String(valor)))
    return fechaHistorial(String(valor));
  if (campo.startsWith('consumo') && Number.isFinite(Number(valor)))
    return `${numero(Number(valor), 2)} L/h`;
  if (camposHoras.has(campo) && Number.isFinite(Number(valor)))
    return `${numero(Number(valor), 2)} h`;
  if (['litrosSolicitados', 'litrosCargados'].includes(campo) && Number.isFinite(Number(valor)))
    return `${numero(Number(valor), 2)} L`;
  if (campo === 'eliminado') return valor === 'true' ? 'Sí' : 'No';
  return String(valor);
}

export function cambiosRelevantes(
  valores: Record<string, string | number>,
  anteriores?: Record<string, string | number>,
) {
  const nombres: Record<string, string> = {
    tipoId: 'tipo',
    marcaId: 'marca',
    modeloId: 'modelo',
    tipoCombustibleId: 'tipoCombustible',
    ubicacionId: 'pkResidente',
    ubicacionResidenteId: 'ubicacionResidente',
    operadorId: 'operador',
    residenteId: 'nombreResidente',
    despachadorId: 'nombreDespachador',
    frenteId: 'actividad',
  };
  return Object.entries(valores).filter(
    ([campo, valor]) =>
      campo !== 'periodosResidentes' &&
      (!anteriores || anteriores[campo] !== valor) &&
      (!nombres[campo] || !Object.hasOwn(valores, nombres[campo])),
  );
}
