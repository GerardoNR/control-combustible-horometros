import type { BaseDatos } from '../tipos/datos';

export function textoMaquinaria(base: BaseDatos, id: string): string {
  const equipo = base.maquinarias.find((registro) => registro.id === id);
  return equipo
    ? [equipo.numeroEconomico, equipo.tipo, equipo.marca, equipo.modelo, equipo.placas].join(' ')
    : '';
}
