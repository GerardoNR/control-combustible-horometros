import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { crearMuestraFicticia } from '../../../../pruebas/datos/operaciones-completas';
import { consolidarControlDiario } from './consolidacion';
import { residentesOperacion } from './residentes-operacion';
import { resumirAlertas } from './alertas-maquinaria';
import { evaluarConsumo } from './evaluacion-consumo';
import { esquemaConfiguracionConsumo, camposConsumo } from '../../maquinarias/validaciones/consumo';
import { evaluarMantenimiento } from '../../maquinarias/servicios/mantenimiento';
import { crearReporteControl } from './reporte-control';
import { crearExcelControl } from './exportar-excel';
import { crearPdfControl } from './exportar-pdf';
import { filtrosVacios } from '../utilidades/filtros-control';
import {
  RepositorioLocal,
  claveAlmacenamiento,
} from '../../../compartido/servicios/repositorio-local';
import { usuarios } from '../../../../pruebas/datos/usuarios';

function escenario() {
  const base = crearMuestraFicticia('2026-11-09');
  base.maquinarias = [base.maquinarias[0]];
  const equipo = base.maquinarias[0];
  Object.assign(equipo, {
    consumoMinimoEsperado: 10,
    consumoNormalMaximo: 14,
    consumoAdvertenciaMaximo: 18,
    horasMinimasDiarias: 6,
  });
  base.horometros = base.horometros.filter((registro) => registro.maquinariaId === equipo.id);
  base.combustible = base.combustible.filter((registro) => registro.maquinariaId === equipo.id);
  const fila = () =>
    consolidarControlDiario(base).find((registro) => registro.fecha === '2026-11-09')!;
  const carga = base.combustible.find((registro) => registro.fecha === '2026-11-09')!;
  return { base, equipo, fila, carga };
}
describe('Evaluación compartida de maquinaria', () => {
  it('clasifica los límites propios del equipo; el consumo bajo solo requiere revisión', () => {
    const { equipo, carga, fila } = escenario();
    for (const [litros, nivel] of [
      [80, 'Normal'],
      [112, 'Normal'],
      [113, 'Revisar'],
      [144, 'Revisar'],
      [145, 'Crítica'],
      [40, 'Revisar'],
    ] as const) {
      carga.litrosCargados = litros;
      expect(fila().evaluacion?.nivel).toBe(nivel);
    }
    expect(fila().evaluacion?.motivos.join(' ')).toContain('inferior');
    expect(
      evaluarConsumo(8, 120, { ...equipo, consumoNormalMaximo: 20, consumoAdvertenciaMaximo: 25 }),
    ).toBe('Bueno');
  });
  it('sin parámetros no inventa un rango y detecta cargas sin horas o datos incompletos', () => {
    const { equipo, base, fila } = escenario();
    for (const campo of camposConsumo) delete equipo[campo];
    expect(fila().evaluacion).toMatchObject({ nivel: 'Sin evaluar', rango: null });
    base.horometros = [];
    expect(fila().litrosHora).toBeNull();
    expect(fila().evaluacion?.nivel).toBe('Revisar');
    expect(fila().evaluacion?.motivos.join(' ')).toContain('sin horas');
  });
  it('detecta poca actividad solo con jornada autorizada en días con operaciones', () => {
    const { equipo, fila } = escenario();
    equipo.horasMinimasDiarias = 9;
    expect(fila().evaluacion?.motivos.join(' ')).toContain('Pocas horas');
    expect(fila().evaluacion?.nivel).toBe('Revisar');
    delete equipo.horasMinimasDiarias;
    expect(fila().evaluacion?.nivel).toBe('Normal');
  });
  it('usa el rango de ralentí únicamente con fuentes del mismo régimen', () => {
    const { base, equipo, carga, fila } = escenario();
    Object.assign(equipo, {
      consumoRalentiMinimo: 2,
      consumoRalentiMaximo: 4,
      consumoRalentiAdvertenciaMaximo: 6,
    });
    expect(fila().evaluacion?.nivel).toBe('Sin evaluar');
    for (const registro of [...base.horometros, ...base.combustible])
      registro.regimenOperacion = 'Ralentí';
    carga.litrosCargados = 24;
    expect(fila().evaluacion).toMatchObject({ nivel: 'Normal' });
    expect(fila().evaluacion?.rango).toContain('ralentí');
    carga.litrosCargados = 56;
    expect(fila().evaluacion?.nivel).toBe('Crítica');
    carga.regimenOperacion = 'Trabajo';
    expect(fila().regimenConsumo).toBe('Mixto');
    expect(fila().evaluacion?.nivel).toBe('Sin evaluar');
  });
  it('suma múltiples intervalos y cargas sin duplicar la fila ni cambiar operadores históricos', () => {
    const { base, carga, fila } = escenario();
    const lectura = base.horometros.find((registro) => registro.fecha === carga.fecha)!;
    const final = lectura.lecturaFinal;
    lectura.lecturaFinal -= 4;
    base.horometros.push({
      ...lectura,
      id: 'segundo-intervalo',
      lecturaInicial: lectura.lecturaFinal,
      lecturaFinal: final,
      operador: 'Otro operador histórico',
    });
    carga.litrosCargados = 50;
    base.combustible.push({ ...carga, id: 'segunda-carga', litrosCargados: 50 });
    expect(
      consolidarControlDiario(base).filter((registro) => registro.fecha === carga.fecha),
    ).toHaveLength(1);
    expect(fila()).toMatchObject({ horas: 8, litros: 100, litrosHora: 12.5 });
    expect(fila().operador).toContain('Otro operador histórico');
    expect(resumirAlertas(consolidarControlDiario(base))).toEqual({
      Normal: 1,
      Revisar: 0,
      Crítica: 0,
      'Sin evaluar': 0,
    });
  });
  it('revisa discontinuidades entre días sin clasificar su rendimiento como normal', () => {
    const { base, fila } = escenario();
    const lectura = base.horometros.find((registro) => registro.fecha === '2026-11-09')!;
    lectura.lecturaInicial -= 1;
    expect(fila().evaluacion?.nivel).toBe('Revisar');
    expect(fila().estadoConsumo).toBe('Sin evaluar');
    expect(fila().evaluacion?.motivos.join(' ')).toContain('continuidad');
  });
  it('valida rangos, advertencias, ralentí y jornada sin exigir combustible para configurar solo actividad', () => {
    const { equipo } = escenario();
    expect(
      esquemaConfiguracionConsumo.safeParse({
        horasMinimasDiarias: 8,
        referenciaConsumo: 'Criterio de prueba autorizado',
        validadoConsumoPor: 'Supervisión',
        fechaValidacionConsumo: '2026-11-01',
      }).success,
    ).toBe(true);
    for (const cambio of [
      { consumoMinimoEsperado: 20 },
      { horasMinimasDiarias: 25 },
      { consumoRalentiMinimo: 2 },
      { consumoAdvertenciaMinimo: 11 },
    ])
      expect(esquemaConfiguracionConsumo.safeParse({ ...equipo, ...cambio }).success).toBe(false);
  });
  it('resuelve residentes por fecha sin reescribir fuentes ni periodos históricos', () => {
    const { base, equipo } = escenario();
    const fuentes = structuredClone({ horometros: base.horometros, combustible: base.combustible });
    const periodos = structuredClone(equipo.periodosResidentes);
    const vigente = equipo.periodosResidentes!.find((periodo) => periodo.fin === null)!;
    vigente.nombre = 'Residente actual de prueba';
    vigente.pk = '080+500';
    for (const fila of consolidarControlDiario(base)) {
      const asignacion = residentesOperacion(equipo, fila.fecha, base);
      expect([fila.residente, fila.pkUbicacion]).toEqual([
        asignacion.residente,
        asignacion.pkUbicacion,
      ]);
    }
    expect(base.horometros).toEqual(fuentes.horometros);
    expect(base.combustible).toEqual(fuentes.combustible);
    expect(equipo.periodosResidentes![0]).toEqual(periodos![0]);
  });
  it('comparte niveles, cifras y colores en reportes de una hoja y una tabla principal', async () => {
    const { base, carga } = escenario();
    carga.litrosCargados = 160;
    const registros = consolidarControlDiario(base);
    const reporte = crearReporteControl(registros, filtrosVacios, 'EXC-101');
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load((await crearExcelControl(reporte)).buffer as ArrayBuffer);
    const hoja = libro.worksheets[0];
    expect(libro.worksheets).toHaveLength(1);
    expect(hoja.columnCount).toBe(11);
    expect(hoja.getCell('K5').value).toBe('Crítica');
    expect(hoja.getCell('K5').fill).toMatchObject({ fgColor: { argb: 'FFFCE8E8' } });
    expect(hoja.getCell('K5').note).toContain('umbral crítico');
    expect(hoja.getCell('I8').value).toBe(318);
    const pdf = crearPdfControl(reporte).output();
    expect(pdf.match(/TOTAL GENERAL/g)).toHaveLength(1);
  });
  it('proyecta el mantenimiento por lectura acumulada, con restantes no negativos y vencimiento explícito', () => {
    const base = crearMuestraFicticia('2026-11-09');
    for (const [indice, horas, restantes, excedidas] of [
      [0, 120, 130, 0],
      [1, 200, 50, 0],
      [2, 250, 0, 0],
      [3, 251, 0, 1],
    ]) {
      const resumen = evaluarMantenimiento(base.maquinarias[indice], base);
      expect(resumen).toMatchObject({ horas, restantes, excedidas });
      expect(resumen.objetivo).toBe(resumen.servicio!.lecturaHorometro + 250);
    }
  });
  it('persiste parámetros adicionales y su auditoría sin alterar los registros fuente', async () => {
    let contenido: string | null = null;
    vi.stubGlobal('localStorage', {
      getItem: () => contenido,
      setItem: (_clave: string, valor: string) => {
        contenido = valor;
      },
    });
    try {
      const repositorio = new RepositorioLocal(() => crearMuestraFicticia('2026-11-09'));
      const base = await repositorio.cargar();
      const equipo = base.maquinarias[0];
      const fuentes = structuredClone(base.combustible);
      await repositorio.guardar(
        'maquinarias',
        { ...equipo, consumoMinimoEsperado: 8, horasMinimasDiarias: 6 },
        equipo.id,
        usuarios[0],
        base,
      );
      const actual = (await repositorio.cargar()).maquinarias[0];
      expect(actual).toMatchObject({ consumoMinimoEsperado: 8, horasMinimasDiarias: 6 });
      expect(actual.historial.at(-1)?.valores).toMatchObject({
        consumoMinimoEsperado: 8,
        horasMinimasDiarias: 6,
      });
      expect((await repositorio.cargar()).combustible).toEqual(fuentes);
      expect(JSON.parse(contenido!)).toHaveProperty('maquinarias');
      expect(claveAlmacenamiento).toBe('marimba.datos.v1');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
