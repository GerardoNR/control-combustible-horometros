import type { BaseDatos, Usuario } from '../../../compartido/tipos/datos';
import type { DatosMaquinaria, Maquinaria } from '../tipos/maquinaria';
import { fechaCalendario } from '../../../compartido/utilidades/formato';
import { fecha as esquemaFecha } from '../../../compartido/validaciones/campos';
export function instanteFechaResidente(fecha: string, actual = new Date()): string {
  if (!esquemaFecha.safeParse(fecha).success)
    throw new Error('Ingresa una fecha de asignación válida.');
  if (fecha > fechaCalendario(actual))
    throw new Error('La fecha de asignación no puede ser futura.');
  const instante = fecha === fechaCalendario(actual) ? actual : new Date(`${fecha}T00:00:00`);
  return instante.toISOString();
}
export function prepararResidencia(
  datos: DatosMaquinaria,
  anterior: Maquinaria | undefined,
  base: BaseDatos,
  usuario: Usuario,
  ahora: string,
  inicioSolicitado?: string,
) {
  const inicioAsignacion = inicioSolicitado ?? ahora;
  const periodos = anterior?.periodosResidentes ?? [];
  const vigente = periodos.find((p) => p.fin === null);
  const residenteIdVigente = vigente?.residenteId ?? anterior?.residenteId;
  const asignacionExplicita =
    inicioSolicitado !== undefined ||
    (!!datos.motivoCambioResidente &&
      datos.motivoCambioResidente !== anterior?.motivoCambioResidente);
  const residenteIdElegido =
    vigente && !asignacionExplicita ? vigente.residenteId : datos.residenteId;
  const residenteActual = base.catalogos?.find(
    (r) => r.id === residenteIdElegido && r.tipo === 'residentes',
  );
  const mismoResidente = residenteIdElegido === residenteIdVigente;
  const pkElegido =
    (vigente && !asignacionExplicita ? vigente.pk : datos.ubicacionResidente) ??
    (mismoResidente ? vigente?.pk : undefined) ??
    residenteActual?.pk ??
    '';
  const cambio =
    (residenteIdElegido || '') !== (residenteIdVigente || '') ||
    (!!vigente && datos.ubicacionResidente !== undefined && vigente.pk !== pkElegido) ||
    (!!datos.motivoCambioResidente &&
      datos.motivoCambioResidente !== anterior?.motivoCambioResidente) ||
    (!!inicioSolicitado &&
      !!vigente &&
      Date.parse(inicioAsignacion) !== Date.parse(vigente.inicio));
  const confirmacion =
    residenteIdElegido &&
    (!vigente || vigente.nombre !== residenteActual?.nombre || vigente.pk !== pkElegido) &&
    datos.motivoCambioResidente &&
    datos.motivoCambioResidente !== anterior?.motivoCambioResidente;
  if (!cambio && !confirmacion)
    return {
      ...datos,
      ...(vigente
        ? {
            residenteId: vigente.residenteId,
            ubicacionResidente: vigente.pk,
            ubicacionResidenteId: vigente.ubicacionId,
          }
        : {}),
      periodosResidentes: anterior?.periodosResidentes,
    };
  if (vigente && Date.parse(inicioAsignacion) <= Date.parse(vigente.inicio))
    throw new Error('El cambio debe ser posterior al inicio vigente.');
  const motivo =
    datos.motivoCambioResidente &&
    (inicioSolicitado || datos.motivoCambioResidente !== anterior?.motivoCambioResidente)
      ? datos.motivoCambioResidente
      : 'Actualización del residente responsable';
  const responsable = {
    motivo,
    registradoEn: ahora,
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
  };
  const actualizados = periodos.map((p) =>
    p.id === vigente?.id ? { ...p, fin: inicioAsignacion, cierre: responsable } : p,
  );
  if (residenteIdElegido) {
    const residente = base.catalogos?.find(
      (r) =>
        r.id === residenteIdElegido &&
        r.tipo === 'residentes' &&
        (r.activo || r.id === residenteIdVigente),
    );
    if (!residente) throw new Error('Selecciona un residente válido del catálogo.');
    actualizados.push({
      ...responsable,
      id: crypto.randomUUID(),
      residenteId: residente.id,
      nombre: residente.nombre,
      pk: pkElegido,
      ubicacionId: datos.ubicacionResidenteId,
      inicio: inicioAsignacion,
      fin: null,
    });
  }
  return {
    ...datos,
    residenteId: residenteIdElegido ?? '',
    ubicacionResidente: residenteIdElegido ? pkElegido : undefined,
    ubicacionResidenteId: residenteIdElegido ? datos.ubicacionResidenteId : undefined,
    motivoCambioResidente: motivo,
    periodosResidentes: actualizados,
  };
}
