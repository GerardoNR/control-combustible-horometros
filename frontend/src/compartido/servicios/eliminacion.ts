import type { BaseDatos, MapaRegistros, Usuario } from '../tipos/datos';
import { exigirEscritura } from '../../modulos/acceso/servicios/permisos';
export type ModuloFuente = 'horometros' | 'combustible';
export function marcarEliminado<Clave extends ModuloFuente>(
  modulo: Clave,
  id: string,
  usuario: Usuario,
  base: BaseDatos,
): MapaRegistros[Clave] {
  exigirEscritura(usuario, modulo);
  const registro = base[modulo].find((registro) => registro.id === id);
  if (!registro || registro.eliminado)
    throw new Error('El registro ya no está disponible. Recarga los datos.');
  const fecha = new Date().toISOString();
  return {
    ...registro,
    eliminado: true,
    modificadoEn: fecha,
    modificadoPor: usuario.nombre,
    historial: [
      ...registro.historial,
      {
        fecha,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'Eliminación',
        valores: { eliminado: 'Sí' },
        anteriores: { eliminado: 'No' },
      },
    ],
  } as MapaRegistros[Clave];
}
