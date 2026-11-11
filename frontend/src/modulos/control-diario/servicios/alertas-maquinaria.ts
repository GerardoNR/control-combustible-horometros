import type { Maquinaria } from '../../maquinarias/tipos/maquinaria';
import type { OperacionConsolidada } from '../tipos/consolidado';
import {
  esquemaConfiguracionConsumo,
  esquemaLimitesConsumo,
} from '../../maquinarias/validaciones/consumo';
import { evaluarConsumo } from './evaluacion-consumo';
import { numero } from '../../../compartido/utilidades/formato';

export type NivelAlerta = 'Normal' | 'Revisar' | 'Crítica' | 'Sin evaluar';
export interface EvaluacionMaquinaria {
  nivel: NivelAlerta;
  motivos: string[];
  rango: string | null;
}
export const coloresAlerta: Record<NivelAlerta, { fondo: string; texto: string }> = {
  Normal: { fondo: '#E7F4EA', texto: '#166534' },
  Revisar: { fondo: '#FFF6DA', texto: '#854D0E' },
  Crítica: { fondo: '#FCE8E8', texto: '#991B1B' },
  'Sin evaluar': { fondo: '#FFF1F2', texto: '#9F1239' },
};

export function evaluarOperacion(
  registro: Pick<OperacionConsolidada, 'horas' | 'litros' | 'pendientes' | 'regimenConsumo'>,
  maquinaria?: Maquinaria,
): EvaluacionMaquinaria {
  const motivos: string[] = [];
  const comparables = !registro.pendientes.some((motivo) =>
    /Revisar (lecturas|cargas|continuidad)/.test(motivo),
  );
  const consumo = evaluarConsumo(
    comparables ? registro.horas : null,
    registro.litros,
    maquinaria,
    registro.regimenConsumo,
  );
  const parametros = esquemaLimitesConsumo.safeParse(maquinaria);
  const ralentí = registro.regimenConsumo === 'Ralentí';
  const minimo = ralentí ? maquinaria?.consumoRalentiMinimo : maquinaria?.consumoMinimoEsperado;
  const maximo = ralentí ? maquinaria?.consumoRalentiMaximo : maquinaria?.consumoNormalMaximo;
  const rango =
    parametros.success &&
    maximo !== undefined &&
    registro.regimenConsumo !== 'Mixto' &&
    !(maquinaria?.consumoRalentiMaximo !== undefined && !registro.regimenConsumo)
      ? `${minimo === undefined ? 'Hasta' : numero(minimo, 2) + ' a'} ${numero(maximo, 2)} L/h${ralentí ? ' · ralentí' : ' · referencia operativa'}`
      : null;
  if (registro.pendientes.length) motivos.push(...registro.pendientes);
  if ((registro.litros ?? 0) > 0 && (registro.horas === null || registro.horas <= 0))
    motivos.push('Combustible cargado sin horas trabajadas válidas');
  const configuracion = esquemaConfiguracionConsumo.safeParse(maquinaria);
  if (
    configuracion.success &&
    configuracion.data.horasMinimasDiarias !== undefined &&
    registro.horas !== null &&
    registro.horas < configuracion.data.horasMinimasDiarias
  )
    motivos.push(
      `Pocas horas: mínimo esperado ${numero(configuracion.data.horasMinimasDiarias, 2)} h por día con operaciones`,
    );
  if (consumo === 'Malo') motivos.push('Consumo superior al umbral crítico configurado');
  if (consumo === 'Medio') {
    const rendimiento =
      registro.horas && registro.litros !== null ? registro.litros / registro.horas : null;
    motivos.push(
      rendimiento !== null && minimo !== undefined && rendimiento < minimo
        ? !ralentí &&
          maquinaria?.consumoAdvertenciaMinimo !== undefined &&
          rendimiento < maquinaria.consumoAdvertenciaMinimo
          ? 'Consumo inferior al umbral de advertencia; revisar carga de trabajo y comparabilidad'
          : 'Consumo inferior al rango esperado; revisar carga de trabajo y comparabilidad'
        : 'Consumo superior al rango esperado',
    );
  }
  if (consumo === 'Sin evaluar')
    motivos.push(
      registro.regimenConsumo === 'Mixto' ||
        (maquinaria?.consumoRalentiMaximo !== undefined && !registro.regimenConsumo)
        ? 'Régimen de operación no comparable o sin identificar'
        : 'Datos o parámetros técnicos insuficientes',
    );
  return {
    nivel:
      consumo === 'Malo'
        ? 'Crítica'
        : motivos.some(
              (motivo) =>
                ![
                  'Datos o parámetros técnicos insuficientes',
                  'Régimen de operación no comparable o sin identificar',
                ].includes(motivo),
            )
          ? 'Revisar'
          : consumo === 'Sin evaluar'
            ? 'Sin evaluar'
            : 'Normal',
    motivos: [...new Set(motivos)],
    rango,
  };
}
export function detalleAlerta(registro: OperacionConsolidada) {
  const evaluacion = registro.evaluacion;
  return {
    nivel: evaluacion?.nivel ?? 'Sin evaluar',
    motivos: evaluacion?.motivos ?? [],
    rango: evaluacion?.rango ? `Rango técnico: ${evaluacion.rango}` : null,
  } as const;
}

export function recomendacionAlerta(registro: OperacionConsolidada) {
  const { nivel, motivos } = detalleAlerta(registro);
  if (nivel === 'Normal') return 'Consumo dentro del rango esperado';
  if (nivel === 'Crítica') return 'Consumo superior al rango técnico';
  if (nivel === 'Sin evaluar') return 'Faltan parámetros para evaluar';
  if (motivos.some((motivo) => /sin horas trabajadas válidas/i.test(motivo)))
    return 'Combustible registrado sin horas válidas';
  if (motivos.some((motivo) => /inferior/i.test(motivo)))
    return 'Consumo inferior al rango esperado; verificar condiciones de operación';
  if (motivos.some((motivo) => /superior/i.test(motivo)))
    return 'Consumo superior al rango técnico';
  return 'Revisar lecturas y condiciones de operación';
}

export function textoEvaluacion(registro: OperacionConsolidada) {
  const evaluacion = registro.evaluacion;
  return !evaluacion
    ? registro.estadoConsumo
    : evaluacion.nivel === 'Sin evaluar'
      ? 'Sin evaluar'
      : `${evaluacion.nivel} · ${registro.estadoConsumo}`;
}
export function resumirAlertas(registros: OperacionConsolidada[]) {
  const prioridades: Record<NivelAlerta, number> = {
    Normal: 0,
    'Sin evaluar': 1,
    Revisar: 2,
    Crítica: 3,
  };
  const equipos = new Map<string, NivelAlerta>();
  for (const registro of registros) {
    const nivel = registro.evaluacion?.nivel ?? 'Sin evaluar';
    const anterior = equipos.get(registro.maquinariaId);
    if (!anterior || prioridades[nivel] > prioridades[anterior])
      equipos.set(registro.maquinariaId, nivel);
  }
  return Object.fromEntries(
    (Object.keys(prioridades) as NivelAlerta[]).map((nivel) => [
      nivel,
      [...equipos.values()].filter((valor) => valor === nivel).length,
    ]),
  ) as Record<NivelAlerta, number>;
}
