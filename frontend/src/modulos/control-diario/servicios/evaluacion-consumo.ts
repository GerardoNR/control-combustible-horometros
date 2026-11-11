import { esquemaLimitesConsumo, camposConsumo } from '../../maquinarias/validaciones/consumo';
import type { Maquinaria } from '../../maquinarias/tipos/maquinaria';
import type { Usuario } from '../../../compartido/tipos/datos';
import { puedeAdministrar } from '../../acceso/servicios/permisos';

export type EstadoConsumo = 'Bueno' | 'Medio' | 'Malo' | 'Sin evaluar';
export const coloresConsumo: Record<EstadoConsumo, { fondo: string; texto: string }> = {
  Bueno: { fondo: '#E7F4EA', texto: '#166534' },
  Medio: { fondo: '#FFF6DA', texto: '#854D0E' },
  Malo: { fondo: '#FCE8E8', texto: '#991B1B' },
  'Sin evaluar': { fondo: '#F1F5F9', texto: '#475569' },
};
export function evaluarConsumo(
  horas: number | null,
  litros: number | null,
  maquinaria?: Maquinaria,
  regimen?: string,
): EstadoConsumo {
  if (
    horas === null ||
    litros === null ||
    !Number.isFinite(horas) ||
    !Number.isFinite(litros) ||
    horas <= 0 ||
    litros < 0
  )
    return 'Sin evaluar';
  const limites = esquemaLimitesConsumo.safeParse(maquinaria);
  if (!limites.success) return 'Sin evaluar';
  if (regimen === 'Mixto' || (limites.data.consumoRalentiMaximo !== undefined && !regimen))
    return 'Sin evaluar';
  const ralentí = regimen === 'Ralentí';
  const maximo = ralentí ? limites.data.consumoRalentiMaximo : limites.data.consumoNormalMaximo;
  const minimo = ralentí ? limites.data.consumoRalentiMinimo : limites.data.consumoMinimoEsperado;
  const advertencia = ralentí
    ? limites.data.consumoRalentiAdvertenciaMaximo
    : limites.data.consumoAdvertenciaMaximo;
  if (maximo === undefined) return 'Sin evaluar';
  const consumo = litros / horas;
  if (minimo !== undefined && consumo < minimo) return 'Medio';
  return consumo <= maximo
    ? 'Bueno'
    : advertencia === undefined || consumo <= advertencia
      ? 'Medio'
      : 'Malo';
}
export function exigirPermisoConsumo(
  datos: object,
  anterior: object | undefined,
  usuario: Usuario,
) {
  if (
    camposConsumo.some(
      (campo) =>
        Reflect.get(datos, campo) !== (anterior ? Reflect.get(anterior, campo) : undefined),
    ) &&
    !puedeAdministrar(usuario)
  )
    throw new Error('Solo el administrador puede configurar límites de consumo validados.');
}
