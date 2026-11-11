import { describe, expect, it } from 'vitest';
import { crearDemostracion } from '../../../pruebas/datos/operaciones-legadas';
import { validarRegistro } from './reglas-negocio';
import { esquemaHorometro } from '../../modulos/horometros/validaciones/horometro';
import { esquemaSuministro } from '../../modulos/combustible/validaciones/suministro';
describe('Validaciones de negocio', () => {
  it('rechaza económicos duplicados sin distinguir mayúsculas ni espacios', () => {
    const base = crearDemostracion();
    expect(() =>
      validarRegistro(
        'maquinarias',
        { ...base.maquinarias[0], numeroEconomico: ' exc-001 ' },
        undefined,
        base,
      ),
    ).toThrow('ya está registrado');
    expect(() =>
      validarRegistro('maquinarias', base.maquinarias[0], base.maquinarias[0].id, base),
    ).not.toThrow();
  });
  it('rechaza lecturas negativas, invertidas, más de 24 horas y asignación posterior', () => {
    const registro = crearDemostracion().horometros[0];
    for (const datos of [
      { lecturaInicial: -1 },
      { lecturaFinal: registro.lecturaInicial - 1 },
      { lecturaFinal: registro.lecturaInicial + 25 },
      { fechaAsignacion: '2100-01-01' },
    ]) {
      expect(esquemaHorometro.safeParse({ ...registro, ...datos }).success).toBe(false);
    }
  });
  it('evita lecturas diarias duplicadas e inconsistencias cronológicas', () => {
    const base = crearDemostracion();
    const registro = base.horometros[0];
    expect(() => validarRegistro('horometros', registro, undefined, base)).toThrow('Ya existe');
    expect(() =>
      validarRegistro(
        'horometros',
        { ...registro, fecha: '2099-01-01', lecturaInicial: 0, lecturaFinal: 8 },
        undefined,
        base,
      ),
    ).toThrow(/no son consistentes|no puede estar en el futuro/);
  });
  it('valida equipos existentes y rechaza la captura en Control Diario', () => {
    const base = crearDemostracion();
    expect(() =>
      validarRegistro(
        'combustible',
        { ...base.combustible[0], maquinariaId: 'inexistente' },
        undefined,
        base,
      ),
    ).toThrow('maquinaria registrada');
    expect(() =>
      validarRegistro('control-diario', base['control-diario'][0], undefined, base),
    ).toThrow('solo consulta');
  });
  it('acepta sobrecargas, pero rechaza litros negativos y horarios inválidos', () => {
    const registro = crearDemostracion().combustible[0];
    expect(esquemaSuministro.safeParse({ ...registro, litrosCargados: 150 }).success).toBe(true);
    expect(esquemaSuministro.safeParse({ ...registro, litrosCargados: -1 }).success).toBe(false);
    expect(esquemaSuministro.safeParse({ ...registro, horaCarga: '25:90' }).success).toBe(false);
  });
});
