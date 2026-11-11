import { describe, expect, it } from 'vitest';
import { operadorEnInstante, residenteMaquinaria } from './responsables';
import { aplicarCambioOperador } from '../../horometros/servicios/asignaciones-operadores';
import { crearDemostracion } from '../../../../pruebas/datos/operaciones-legadas';
import { usuarios } from '../../../../pruebas/datos/usuarios';
import { catalogosIniciales } from '../../../compartido/catalogos/servicios/catalogos';
describe('Responsables de maquinaria', () => {
  it('consulta cambios por fecha con inicio incluido y fin excluido y conserva nombres históricos', () => {
    const base = crearDemostracion();
    base.asignacionesOperadores = aplicarCambioOperador(
      {
        maquinariaId: 'maq-1',
        operadorNuevo: 'Primero',
        inicio: '2020-01-01T08:00:00Z',
        motivo: 'Alta',
        asignacionAnteriorId: null,
      },
      usuarios[0],
      base,
    );
    const primera = base.asignacionesOperadores[0];
    base.asignacionesOperadores = aplicarCambioOperador(
      {
        maquinariaId: 'maq-1',
        operadorNuevo: 'Segundo',
        inicio: '2020-02-01T08:00:00Z',
        motivo: 'Cambio',
        asignacionAnteriorId: primera.id,
      },
      usuarios[0],
      base,
    );
    expect(operadorEnInstante(base, 'maq-1', '2019-12-01T08:00:00Z')).toBeUndefined();
    expect(operadorEnInstante(base, 'maq-1', '2020-01-01T08:00:00Z')?.operador).toBe('Primero');
    expect(operadorEnInstante(base, 'maq-1', '2020-02-01T07:59:59Z')?.operador).toBe('Primero');
    expect(operadorEnInstante(base, 'maq-1', '2020-02-01T08:00:00Z')?.operador).toBe('Segundo');
    expect(operadorEnInstante(base, 'maq-1')?.operador).toBe('Segundo');
    expect(base.horometros[0].operador).not.toBe('Segundo');
  });
  it('resuelve residente y PK desde el catálogo sin deducirlo de un suministro', () => {
    const base = crearDemostracion();
    base.catalogos = catalogosIniciales(base);
    const equipo = base.maquinarias[0];
    expect(residenteMaquinaria(base, equipo)).toBeUndefined();
    const residente = base.catalogos.find((r) => r.tipo === 'residentes')!;
    equipo.residenteId = residente.id;
    expect(residenteMaquinaria(base, equipo)).toBe(residente);
    residente.pk = '040+000';
    expect(residenteMaquinaria(base, equipo)?.pk).toBe('040+000');
  });
});
