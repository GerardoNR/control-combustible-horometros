import { buscarCatalogo } from '../../../compartido/catalogos/servicios/catalogos';
import { normalizarOperador } from '../utilidades/operadores';
import type { BaseDatos, Usuario } from '../../../compartido/tipos/datos';
import { exigirEscritura } from '../../acceso/servicios/permisos';
import type { AsignacionOperador, DatosCambioOperador } from '../tipos/asignacion-operador';
import { esquemaCambioOperador } from '../validaciones/asignacion-operador';
export function asignacionVigente(asignaciones: AsignacionOperador[], maquinariaId: string) {
  return asignaciones.find(
    (asignacion) => asignacion.maquinariaId === maquinariaId && asignacion.fin === null,
  );
}
export function validarCambioOperador(
  datos: DatosCambioOperador,
  base: BaseDatos,
  ahora = new Date().toISOString(),
) {
  const resultado = esquemaCambioOperador.safeParse(datos);
  if (!resultado.success) throw new Error(resultado.error.issues[0].message);
  const validos = resultado.data;
  if (!base.maquinarias.some((equipo) => equipo.id === validos.maquinariaId && !equipo.eliminado))
    throw new Error('Selecciona una maquinaria registrada.');
  const inicio = Date.parse(validos.inicio);
  if (inicio > Date.parse(ahora))
    throw new Error(
      'La fecha de inicio no puede estar en el futuro. Registra un cambio ya efectuado.',
    );
  const asignaciones = base.asignacionesOperadores ?? [];
  const activas = asignaciones.filter(
    (asignacion) => asignacion.maquinariaId === validos.maquinariaId && asignacion.fin === null,
  );
  if (activas.length > 1)
    throw new Error(
      'Hay asignaciones incompatibles para esta maquinaria. Revisa los datos antes de continuar.',
    );
  const anterior = activas[0];
  if ((anterior?.id ?? null) !== validos.asignacionAnteriorId)
    throw new Error(
      'La asignación cambió desde que abriste el formulario. Ciérralo y vuelve a abrirlo con los datos actuales.',
    );
  if (
    anterior &&
    normalizarOperador(anterior.operador) === normalizarOperador(validos.operadorNuevo)
  )
    throw new Error('El nuevo operador debe ser diferente al operador vigente.');
  if (anterior && inicio <= Date.parse(anterior.inicio))
    throw new Error('El cambio debe comenzar después del inicio de la asignación vigente.');
  if (
    asignaciones.some(
      (asignacion) =>
        asignacion.maquinariaId === validos.maquinariaId &&
        asignacion.id !== anterior?.id &&
        (asignacion.fin === null || Date.parse(asignacion.fin) > inicio),
    )
  )
    throw new Error('La fecha se superpone con una asignación ya registrada para esta maquinaria.');
  if (
    asignaciones.some(
      (asignacion) =>
        asignacion.maquinariaId !== validos.maquinariaId &&
        normalizarOperador(asignacion.operador) === normalizarOperador(validos.operadorNuevo) &&
        (asignacion.fin === null || Date.parse(asignacion.fin) > inicio),
    )
  )
    throw new Error(
      'Ese operador tiene una asignación incompatible en otra maquinaria durante este periodo.',
    );
  return { validos, anterior };
}
export function aplicarCambioOperador(
  datos: DatosCambioOperador,
  usuario: Usuario,
  base: BaseDatos,
  ahora = new Date().toISOString(),
  crearId: () => string = () => crypto.randomUUID(),
): AsignacionOperador[] {
  exigirEscritura(usuario, 'maquinarias');
  const { validos, anterior } = validarCambioOperador(datos, base, ahora);
  const asignaciones = (base.asignacionesOperadores ?? []).map((asignacion) =>
    asignacion.id === anterior?.id
      ? {
          ...asignacion,
          fin: validos.inicio,
          cierre: {
            motivo: validos.motivo,
            registradoEn: ahora,
            usuarioResponsableId: usuario.id,
            usuarioResponsableNombre: usuario.nombre,
          },
        }
      : asignacion,
  );
  return [
    ...asignaciones,
    {
      id: crearId(),
      maquinariaId: validos.maquinariaId,
      operador: validos.operadorNuevo,
      operadorId:
        validos.operadorId ?? buscarCatalogo(base, 'operadores', validos.operadorNuevo)?.id,
      inicio: validos.inicio,
      fin: null,
      asignacionAnteriorId: anterior?.id ?? null,
      motivo: validos.motivo,
      registradoEn: ahora,
      usuarioResponsableId: usuario.id,
      usuarioResponsableNombre: usuario.nombre,
    },
  ];
}
