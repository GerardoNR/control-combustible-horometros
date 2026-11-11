import type { BaseDatos } from '../../../compartido/tipos/datos';
import type { Maquinaria } from '../tipos/maquinaria';
export function operadorEnInstante(
  base: BaseDatos,
  maquinariaId: string,
  instante = new Date().toISOString(),
) {
  const fecha = Date.parse(instante);
  return (base.asignacionesOperadores ?? []).find(
    (r) =>
      r.maquinariaId === maquinariaId &&
      Date.parse(r.inicio) <= fecha &&
      (r.fin === null || fecha < Date.parse(r.fin)),
  );
}
interface ReferenciaResidente {
  nombre: string;
  pk?: string;
  residenteId?: string;
  ubicacionId?: string;
  inicio?: string;
}

export function residenteMaquinaria(
  base: Pick<BaseDatos, 'catalogos'>,
  maquinaria: Maquinaria | undefined,
): ReferenciaResidente | undefined {
  if (!maquinaria) return undefined;
  const vigente = maquinaria.periodosResidentes?.find((periodo) => periodo.fin === null);
  if (vigente || maquinaria.periodosResidentes?.length) return vigente;
  const residente = base.catalogos?.find(
    (r) => r.id === maquinaria.residenteId && r.tipo === 'residentes',
  );
  const ubicacion = base.catalogos?.find(
    (r) => r.id === maquinaria.ubicacionResidenteId && r.tipo === 'ubicaciones',
  );
  const pk = maquinaria.ubicacionResidente ?? ubicacion?.nombre;
  return pk === undefined
    ? residente
    : {
        nombre: residente?.nombre ?? '',
        pk,
        residenteId: residente?.id,
        ubicacionId: ubicacion?.id,
      };
}

export function residenteEnInstante(maquinaria: Maquinaria | undefined, instante: string) {
  const fecha = Date.parse(instante);
  return maquinaria?.periodosResidentes?.find(
    (periodo) =>
      Date.parse(periodo.inicio) <= fecha &&
      (periodo.fin === null || fecha < Date.parse(periodo.fin)),
  );
}

export function residenteParaCaptura(
  base: Pick<BaseDatos, 'catalogos'>,
  maquinaria: Maquinaria | undefined,
  instante: string,
): ReferenciaResidente | undefined {
  return maquinaria?.periodosResidentes?.length
    ? residenteEnInstante(maquinaria, instante)
    : residenteMaquinaria(base, maquinaria);
}
