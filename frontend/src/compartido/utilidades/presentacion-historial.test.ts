import { describe, expect, it } from 'vitest';
import { crearMuestraFicticia } from '../../../pruebas/datos/operaciones-completas';
import {
  cambiosRelevantes,
  etiquetaHistorial,
  fechaHistorial,
  valorHistorial,
} from './presentacion-historial';

const base = crearMuestraFicticia('2026-11-09');
describe('Presentación de historial sin alterar los datos', () => {
  it('resuelve referencias, unidades y etiquetas sin exponer identificadores', () => {
    expect(valorHistorial('maquinariaId', 'prueba-maq-01', base)).toBe('EXC-101 · Excavadora');
    expect(valorHistorial('residenteId', 'prueba-residentes-01', base)).toBe(
      'Adriana Isabel Salazar Pérez',
    );
    expect(valorHistorial('asignacionId', 'prueba-asignacion-01', base)).toContain(
      'José Luis García Mendoza',
    );
    expect(valorHistorial('registroId', 'prueba-com-03', base)).toContain('EXC-101 · Excavadora');
    expect(valorHistorial('maquinariaId', 'maq-999', base)).not.toContain('maq-999');
    expect(valorHistorial('litrosCargados', 40, base)).toBe('40 L');
    expect(valorHistorial('lecturaFinal', 2421, base)).toBe('2,421 h');
    expect(etiquetaHistorial('capturaInicialSupervisada')).toBe('Confirmación de lectura inicial');
    expect(etiquetaHistorial('motivoAnterior')).toBe('Motivo anterior');
    expect(valorHistorial('operador', undefined, base)).toBe('Sin registrar');
  });
  it('presenta fechas numéricas y conserva los valores anteriores y nuevos sin duplicados', () => {
    expect(fechaHistorial('2026-11-09')).toBe('09/11/2026');
    expect(fechaHistorial('sin fecha')).toBe('Sin fecha registrada');
    const valores = {
      operador: 'Nuevo',
      operadorId: 'id-nuevo',
      litrosCargados: 40,
      horaCarga: '08:30',
    };
    const anteriores = {
      operador: 'Anterior',
      operadorId: 'id-anterior',
      litrosCargados: 30,
      horaCarga: '08:30',
    };
    expect(cambiosRelevantes(valores, anteriores)).toEqual([
      ['operador', 'Nuevo'],
      ['litrosCargados', 40],
    ]);
    expect(anteriores.litrosCargados).toBe(30);
    expect(valores.operadorId).toBe('id-nuevo');
  });
});
