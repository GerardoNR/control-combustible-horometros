import { residenteEnInstante, residenteMaquinaria } from '../../maquinarias/servicios/responsables';
import type { BaseDatos } from '../../../compartido/tipos/datos';
import type { Maquinaria } from '../../maquinarias/tipos/maquinaria';
import { limitesDiaOperativo } from '../utilidades/fechas-reporte';

// Resuelve la asignación vigente al cierre del día operativo.
export function residentesOperacion(
  maquinaria: Maquinaria | undefined,
  fecha: string,
  base?: BaseDatos,
) {
  const fechaCierreDia = new Date(limitesDiaOperativo(fecha).fin - 1);
  const asignacionDelDia = residenteEnInstante(
    maquinaria,
    fechaCierreDia.toISOString(),
  );
  const asignacion = maquinaria?.periodosResidentes?.length
    ? asignacionDelDia
    : residenteMaquinaria(base ?? {}, maquinaria);
  return {
    residente: asignacion?.nombre || 'Sin registrar',
    pkUbicacion: asignacion?.pk || 'Sin registrar',
  };
}
