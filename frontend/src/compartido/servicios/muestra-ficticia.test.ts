import { afterEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import {
  crearMuestraFicticia,
  fechaMuestra,
  muestraActualAplicada,
  versionMuestra,
} from '../../../pruebas/datos/operaciones-completas';
import { esquemaBase } from '../validaciones/base-datos';
import { validarRegistro } from './reglas-negocio';
import { evaluarMantenimiento } from '../../modulos/maquinarias/servicios/mantenimiento';
import { consolidarControlDiario } from '../../modulos/control-diario/servicios/consolidacion';
import { crearReporteControl } from '../../modulos/control-diario/servicios/reporte-control';
import { crearExcelControl } from '../../modulos/control-diario/servicios/exportar-excel';
import { crearPdfControl } from '../../modulos/control-diario/servicios/exportar-pdf';
import { filtrosVacios } from '../../modulos/control-diario/utilidades/filtros-control';
import { RepositorioLocal, claveAlmacenamiento } from './repositorio-local';
import { asignacionParaFecha } from './captura-diaria';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('Muestra ficticia determinista', () => {
  it('incluye el día de carga incluso si la aplicación cruza medianoche', () => {
    vi.useFakeTimers();
    for (const fecha of ['2026-11-09', '2026-11-10']) {
      vi.setSystemTime(new Date(`${fecha}T12:00:00`));
      const base = crearMuestraFicticia();
      for (const registros of [base.horometros, base.combustible]) {
        expect(registros.some((registro) => registro.fecha === fecha)).toBe(true);
        expect(new Set(registros.map((registro) => registro.fecha)).size).toBe(3);
      }
    }
  });
  it('genera exactamente 15/15/15 completos con referencias e intervalos coherentes', () => {
    const base = crearMuestraFicticia();
    expect(crearMuestraFicticia()).toEqual(base);
    expect(esquemaBase.safeParse(base).success).toBe(true);
    expect(base['control-diario']).toEqual([]);
    expect(muestraActualAplicada(base)).toBe(true);
    expect(base.asignacionesOperadores).toHaveLength(30);
    for (const registros of [
      base.maquinarias,
      base.horometros,
      base.combustible,
      base.mantenimientos!,
    ])
      for (const registro of registros) {
        for (const valor of Object.values(registro))
          if (typeof valor === 'string') expect(valor.trim()).not.toBe('');
        expect(registro.historial[0].valores.versionMuestra).toBe(versionMuestra);
      }
    for (const modulo of ['maquinarias', 'horometros', 'combustible'] as const) {
      expect(base[modulo]).toHaveLength(15);
      expect(new Set(base[modulo].map((registro) => registro.id)).size).toBe(15);
      for (const registro of base[modulo])
        expect(() => validarRegistro(modulo, registro, registro.id, base)).not.toThrow();
    }
    for (const registro of [...base.horometros, ...base.combustible]) {
      expect(registro.operadorId).toBeTruthy();
      expect(registro.asignacionId).toBe(
        asignacionParaFecha(
          base,
          registro.maquinariaId,
          registro.fecha,
          'horaCarga' in registro ? registro.horaCarga : undefined,
        )?.id,
      );
      if ('lecturaInicial' in registro) {
        expect(registro).not.toHaveProperty('actividad');
        expect(registro).not.toHaveProperty('frenteId');
        expect(registro).not.toHaveProperty('horaAsignacion');
      }
      expect(registro.historial.map((cambio) => cambio.accion)).toEqual(['Creación', 'Edición']);
    }
    for (const equipo of base.maquinarias) {
      expect(equipo.periodosResidentes).toHaveLength(2);
      for (const campo of [
        'tipoId',
        'marcaId',
        'modeloId',
        'ubicacionResidenteId',
        'consumoNormalMaximo',
        'consumoAdvertenciaMaximo',
        'referenciaConsumo',
        'validadoConsumoPor',
        'fechaValidacionConsumo',
      ] as const)
        expect(equipo[campo]).toBeTruthy();
      expect(equipo.referenciaConsumo).toContain('FICTICIO');
      expect(
        base.asignacionesOperadores!.some(
          (periodo) => periodo.maquinariaId === equipo.id && periodo.fin === null,
        ),
      ).toBe(true);
      expect(
        base.mantenimientos!.filter((servicio) => servicio.maquinariaId === equipo.id),
      ).toHaveLength(2);
    }
    for (const suministro of base.combustible) {
      for (const campo of [
        'residenteId',
        'nombreResidente',
        'pkResidente',
        'numeroOrquesta',
        'nombreDespachador',
        'despachadorId',
        'horaCarga',
        'ubicacionId',
        'tipoCombustibleId',
      ] as const)
        expect(suministro[campo]).toBeTruthy();
      const instante = Date.parse(`${suministro.fecha}T${suministro.horaCarga}:00-06:00`);
      const periodo = base.maquinarias
        .find((equipo) => equipo.id === suministro.maquinariaId)!
        .periodosResidentes!.find(
          (residencia) =>
            Date.parse(residencia.inicio) <= instante &&
            (!residencia.fin || Date.parse(residencia.fin) > instante),
        )!;
      expect([suministro.residenteId, suministro.nombreResidente, suministro.pkResidente]).toEqual([
        periodo.residenteId,
        periodo.nombre,
        periodo.pk,
      ]);
    }
  });
  it('cubre verde, 200/250 amarillo y 251 rojo sin alterar el cálculo existente', () => {
    const base = crearMuestraFicticia();
    expect(
      base.maquinarias.slice(0, 5).map((equipo) => {
        const estado = evaluarMantenimiento(equipo, base);
        return [estado.horas, estado.tono];
      }),
    ).toEqual([
      [120, 'verde'],
      [200, 'amarillo'],
      [250, 'amarillo'],
      [251, 'rojo'],
      [80, 'verde'],
    ]);
  });
  it('consolida las dos cargas y todos los intervalos sin duplicar registros diarios', async () => {
    const base = crearMuestraFicticia();
    const filas = consolidarControlDiario(base);
    expect(filas).toHaveLength(14);
    expect(filas.every((fila) => fila.pendientes.length === 0)).toBe(true);
    const reporte = crearReporteControl(
      filas,
      filtrosVacios,
      '',
      new Date(`${fechaMuestra}T18:00:00Z`),
    );
    expect(reporte.totales).toMatchObject({
      horas: 100,
      litros: 1410,
      litrosHora: 14.1,
      horasLitro: 100 / 1410,
    });
    const doble = filas.find((fila) => fila.maquinariaId === 'prueba-maq-02')!;
    expect(doble).toMatchObject({ horas: 8, litros: 110, litrosHora: 13.75 });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load((await crearExcelControl(reporte)).buffer as ArrayBuffer);
    expect(libro.getWorksheet('Control Diario')!.rowCount).toBe(19);
    expect(libro.getWorksheet('Control Diario')!.getCell('H19').value).toBe(100);
    expect(libro.getWorksheet('Control Diario')!.getCell('I19').value).toBe(1410);
    expect(libro.worksheets.map((hoja) => hoja.name)).toEqual(['Control Diario']);
    const pdf = crearPdfControl(reporte);
    expect(pdf.output()).toContain('TOTAL');
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
  it('inicializa vacío y conserva el almacenamiento existente sin reemplazarlo', async () => {
    const memoria = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (clave: string) => memoria.get(clave) ?? null,
      setItem: (clave: string, valor: string) => memoria.set(clave, valor),
    });
    const repositorio = new RepositorioLocal();
    const inicial = await repositorio.cargar();
    expect(inicial.maquinarias).toEqual([]);
    expect(inicial.horometros).toEqual([]);
    expect(inicial.combustible).toEqual([]);
    expect(inicial['control-diario']).toEqual([]);
    expect(inicial.mantenimientos).toEqual([]);
    expect(inicial.asignacionesOperadores).toEqual([]);
    const serializadaVacia = memoria.get(claveAlmacenamiento)!;
    expect(await repositorio.cargar()).toEqual(inicial);
    expect(memoria.get(claveAlmacenamiento)).toBe(serializadaVacia);

    const datosGuardados = crearMuestraFicticia();
    memoria.set(claveAlmacenamiento, JSON.stringify(datosGuardados));
    const actual = await repositorio.cargar();
    expect(actual.maquinarias).toHaveLength(15);
    expect(memoria.get(claveAlmacenamiento)).toBe(JSON.stringify(datosGuardados));
  });
});
