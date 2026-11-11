import type { Auditoria, BaseDatos } from '../../src/compartido/tipos/datos';
import type { TipoCatalogo } from '../../src/compartido/catalogos/tipos/catalogo';
import { valoresAuditables } from '../../src/compartido/utilidades/auditoria';
import { sumarDiasCalendario } from '../../src/modulos/maquinarias/servicios/mantenimiento';

import { hoy } from '../../src/compartido/utilidades/formato';

export const fechaMuestra = hoy();
export const versionMuestra = 'muestra-completa-2026-11-v2';
const responsable = {
  usuarioId: 'prueba-supervisor',
  usuarioNombre: 'María Fernanda Torres Salinas',
};
const equipos = [
  ['EXC-101', 'Excavadora', 'Caterpillar', '320 GC'],
  ['RET-102', 'Retroexcavadora', 'John Deere', '310 SL'],
  ['MOT-103', 'Motoniveladora', 'Caterpillar', '140 K'],
  ['COM-104', 'Compactador', 'BOMAG', 'BW 211 D'],
  ['CAR-105', 'Cargador frontal', 'Komatsu', 'WA380-8'],
  ['EXC-106', 'Excavadora', 'Volvo', 'EC220D'],
  ['RET-107', 'Retroexcavadora', 'CASE', '580N'],
  ['COM-108', 'Compactador', 'Dynapac', 'CA250D'],
  ['MOT-109', 'Motoniveladora', 'John Deere', '670G'],
  ['CAR-110', 'Cargador frontal', 'Caterpillar', '950 GC'],
  ['EXC-111', 'Excavadora', 'Komatsu', 'PC210LC-11'],
  ['RET-112', 'Retroexcavadora', 'JCB', '3CX'],
  ['COM-113', 'Compactador', 'HAMM', 'H 13i'],
  ['CAR-114', 'Cargador frontal', 'Volvo', 'L90H'],
  ['EXC-115', 'Excavadora', 'Hitachi', 'ZX200-5G'],
];
const operadores = [
  'José Luis García Mendoza',
  'Miguel Ángel López Rivera',
  'Pedro Antonio Sánchez Vega',
  'Roberto Carlos Torres Díaz',
  'Juan Manuel Hernández Cruz',
  'Luis Fernando Martínez Soto',
  'Ricardo Alberto Ramírez Flores',
  'Francisco Javier Morales Peña',
  'Alejandro Ruiz Castillo',
  'Sergio Eduardo Navarro Ríos',
  'Óscar Daniel Jiménez Lara',
  'Héctor Raúl Aguilar Campos',
  'Arturo Enrique Medina Solís',
  'Jorge Armando Vázquez León',
  'Carlos Alberto Reyes Luna',
];
const residentes = [
  'Adriana Isabel Salazar Pérez',
  'Verónica Patricia Castillo Ramos',
  'Daniela Sofía Morales Garza',
];
const despachadores = [
  'Eduardo Iván Pérez Rosales',
  'Gabriela Alejandra Medina Ortiz',
  'Raúl Ernesto Flores Treviño',
];
const operadoresAnteriores = [
  'Ernesto Julián Castro Molina',
  'Manuel Ignacio Ortega Silva',
  'Andrés Felipe Cárdenas Rojas',
  'Ramón Esteban Ponce Villarreal',
  'David Armando Contreras Rosas',
  'Gustavo Adolfo Ríos Medina',
  'Víctor Hugo Luna Escobedo',
  'Raúl Antonio Salinas Leal',
  'César Augusto Treviño Ortiz',
  'Mario Alberto Fuentes Acosta',
  'Felipe de Jesús Lozano Nieto',
  'Ignacio Salvador Peña Castañeda',
  'Gerardo Rafael Cabrera Montes',
  'Adrián Emiliano Padilla Santos',
  'Rubén Darío Valdés Carrillo',
];
const residenteAnterior = 'Patricia Elena Rangel Fuentes';
const clave = (tipo: string, indice: number) =>
  `prueba-${tipo}-${String(indice + 1).padStart(2, '0')}`;
const instante = (fecha: string, hora = '08:00') => `${fecha}T${hora}:00-06:00`;

// Toda la muestra y sus movimientos son ficticios; no proceden de operaciones reales.
export function crearMuestraFicticia(fecha = hoy()): BaseDatos {
  const dia = (desfase: number) => sumarDiasCalendario(fecha, desfase);
  function auditar(id: string, datos: object, fechaRegistro = dia(-60)): Auditoria {
    const valores = valoresAuditables(datos);
    return {
      id,
      creadoEn: instante(fechaRegistro, '18:00'),
      creadoPor: responsable.usuarioNombre,
      modificadoEn: instante(fechaRegistro, '18:30'),
      modificadoPor: responsable.usuarioNombre,
      historial: [
        {
          ...responsable,
          fecha: instante(fechaRegistro, '18:00'),
          accion: 'Creación',
          valores: {
            ...valores,
            muestra: 'Dato ficticio de prueba',
            versionMuestra,
            fechaReferenciaMuestra: fecha,
          },
        },
        {
          ...responsable,
          fecha: instante(fechaRegistro, '18:30'),
          accion: 'Edición',
          anteriores: { revision: 'Pendiente' },
          valores: { revision: 'Verificación ficticia de prueba' },
        },
      ],
    };
  }
  const base: BaseDatos = {
    maquinarias: [],
    horometros: [],
    combustible: [],
    'control-diario': [],
    catalogos: [],
    asignacionesOperadores: [],
    mantenimientos: [],
  };
  function catalogar(tipo: TipoCatalogo, nombres: string[]) {
    nombres.forEach((nombre, indice) => {
      const datos = {
        tipo,
        codigo: `PR-${tipo.slice(0, 3).toUpperCase()}-${indice + 1}`,
        nombre,
        ...(tipo === 'residentes' || tipo === 'frentes'
          ? { pk: `${String(12 + indice * 5).padStart(3, '0')}+350` }
          : {}),
        activo: true,
      };
      base.catalogos!.push({ ...datos, ...auditar(clave(tipo, indice), datos) });
    });
  }
  catalogar('operadores', [...operadores, ...operadoresAnteriores]);
  catalogar('residentes', [...residentes, residenteAnterior]);
  catalogar('despachadores', despachadores);
  catalogar('frentes', ['Excavación norte', 'Terracerías centro', 'Carga y nivelación sur']);
  catalogar('tiposMaquinaria', [...new Set(equipos.map((equipo) => equipo[1]))]);
  catalogar('marcas', [...new Set(equipos.map((equipo) => equipo[2]))]);
  catalogar(
    'modelos',
    equipos.map((equipo) => equipo[3]),
  );
  catalogar('ubicaciones', ['012+350', '017+350', '022+350', '027+350']);
  catalogar('combustibles', ['Diésel', 'Gasolina']);
  const referencia = (tipo: TipoCatalogo, nombre: string) =>
    base.catalogos!.find((entrada) => entrada.tipo === tipo && entrada.nombre === nombre)!.id;

  equipos.forEach(([numeroEconomico, tipo, marca, modelo], indice) => {
    const residente = indice % 3;
    const cambio = instante(dia(-1), '00:00');
    const inicio = instante(dia(-60), '00:00');
    const responsableAsignacion = {
      usuarioResponsableId: responsable.usuarioId,
      usuarioResponsableNombre: responsable.usuarioNombre,
    };
    const asignacionAnteriorId = clave('asignacion-anterior', indice);
    base.asignacionesOperadores!.push({
      id: asignacionAnteriorId!,
      maquinariaId: clave('maq', indice),
      operador: operadoresAnteriores[indice],
      operadorId: clave('operadores', 15 + indice),
      inicio,
      fin: cambio,
      asignacionAnteriorId: null,
      motivo: 'Asignación anterior ficticia de prueba',
      registradoEn: inicio,
      ...responsableAsignacion,
      cierre: {
        motivo: 'Relevo ficticio de prueba',
        registradoEn: cambio,
        ...responsableAsignacion,
      },
    });
    base.asignacionesOperadores!.push({
      id: clave('asignacion', indice),
      maquinariaId: clave('maq', indice),
      operador: operadores[indice],
      operadorId: clave('operadores', indice),
      inicio: cambio,
      fin: null,
      asignacionAnteriorId,
      motivo: 'Asignación vigente ficticia de prueba',
      registradoEn: cambio,
      ...responsableAsignacion,
    });
    const pk = base.catalogos!.find(
      (entrada) => entrada.id === clave('residentes', residente),
    )!.pk!;
    const periodosResidentes = [
      {
        id: clave('residente-anterior', indice),
        residenteId: clave('residentes', 3),
        nombre: residenteAnterior,
        pk: '027+350',
        ubicacionId: referencia('ubicaciones', '027+350'),
        inicio,
        fin: cambio,
        motivo: 'Residencia anterior ficticia de prueba',
        registradoEn: inicio,
        ...responsable,
        cierre: {
          motivo: 'Cambio ficticio de residente y PK',
          registradoEn: cambio,
          ...responsable,
        },
      },
      {
        id: clave('residente-vigente', indice),
        residenteId: clave('residentes', residente),
        nombre: residentes[residente],
        pk,
        ubicacionId: referencia('ubicaciones', pk),
        inicio: cambio,
        fin: null,
        motivo: 'Residencia vigente ficticia de prueba',
        registradoEn: cambio,
        ...responsable,
      },
    ];
    const datos = {
      numeroEconomico,
      tipo,
      marca,
      modelo,
      tipoId: referencia('tiposMaquinaria', tipo),
      marcaId: referencia('marcas', marca),
      modeloId: referencia('modelos', modelo),
      ubicacionResidente: pk,
      ubicacionResidenteId: referencia('ubicaciones', pk),
      placas: `NL-${String(5100 + indice)}-M`,
      estado: (indice === 12
        ? 'En mantenimiento'
        : indice === 14
          ? 'Fuera de servicio'
          : 'Operativa') as BaseDatos['maquinarias'][number]['estado'],
      horometroBase: 2400 + indice * 180,
      residenteId: clave('residentes', residente),
      motivoCambioResidente: 'Cambio ficticio de residente y PK',
      periodosResidentes,
      avisoMantenimientoHoras: 200,
      limiteMantenimientoHoras: 250,
      fechaUltimoMantenimiento: dia(-10),
      fechaProximoMantenimiento: dia(20),
      observacionesMantenimiento: 'Prueba ficticia: filtros, lubricación y niveles verificados.',
      consumoNormalMaximo: [14, 11, 10, 13, 15][indice % 5] + Math.floor(indice / 5) * 0.5,
      consumoAdvertenciaMaximo: [14, 11, 10, 13, 15][indice % 5] + Math.floor(indice / 5) * 0.5 + 2,
      referenciaConsumo:
        'FICTICIO: rango simulado de prueba; no es una referencia técnica oficial.',
      validadoConsumoPor: 'María Fernanda Torres Salinas (personaje ficticio de prueba)',
      fechaValidacionConsumo: dia(-60),
    };
    const auditoria = auditar(clave('maq', indice), {
      ...datos,
      residenteId: clave('residentes', 3),
      ubicacionResidente: '027+350',
      ubicacionResidenteId: referencia('ubicaciones', '027+350'),
    });
    auditoria.modificadoEn = cambio;
    auditoria.historial[1] = {
      ...responsable,
      fecha: cambio,
      accion: 'Edición',
      anteriores: {
        residenteId: clave('residentes', 3),
        ubicacionResidente: '027+350',
        ubicacionResidenteId: referencia('ubicaciones', '027+350'),
      },
      valores: {
        residenteId: datos.residenteId,
        ubicacionResidente: pk,
        ubicacionResidenteId: datos.ubicacionResidenteId,
        motivoCambioResidente: datos.motivoCambioResidente,
        muestra: 'Dato ficticio de prueba',
      },
    };
    base.maquinarias.push({ ...datos, ...auditoria });
  });
  const capturas = [
    { equipo: 0, dias: -2, horas: 6 },
    { equipo: 0, dias: -1, horas: 7 },
    { equipo: 0, dias: 0, horas: 8 },
    { equipo: 1, dias: -1, horas: 4 },
    { equipo: 1, dias: -1, horas: 4 },
    ...Array.from({ length: 10 }, (_, indice) => ({
      equipo: indice + 2,
      dias: -(indice % 3),
      horas: 6 + ((indice + 2) % 3),
    })),
  ];
  capturas.forEach(({ equipo, dias, horas }, indice) => {
    const maquinaria = base.maquinarias[equipo];
    const fechaOperacion = dia(dias);
    const anterior = base.horometros
      .filter((lectura) => lectura.maquinariaId === maquinaria.id)
      .at(-1);
    const asignacion = base.asignacionesOperadores!.find(
      (periodo) =>
        periodo.maquinariaId === maquinaria.id &&
        Date.parse(periodo.inicio) <= Date.parse(instante(fechaOperacion)) &&
        (periodo.fin === null || Date.parse(periodo.fin) > Date.parse(instante(fechaOperacion))),
    )!;
    const datos = {
      fecha: fechaOperacion,
      maquinariaId: maquinaria.id,
      lecturaInicial: anterior?.lecturaFinal ?? maquinaria.horometroBase,
      lecturaFinal: (anterior?.lecturaFinal ?? maquinaria.horometroBase) + horas,
      operador: asignacion.operador,
      operadorId: asignacion.operadorId,
      asignacionId: asignacion.id,
      fechaAsignacion: asignacion.inicio.slice(0, 10),
      capturaInicialSupervisada: 'Confirmada por administrador' as const,
    };
    base.horometros.push({ ...datos, ...auditar(clave('hor', indice), datos, fechaOperacion) });
    const residente = maquinaria.periodosResidentes!.find(
      (periodo) =>
        Date.parse(periodo.inicio) <= Date.parse(instante(fechaOperacion)) &&
        (periodo.fin === null || Date.parse(periodo.fin) > Date.parse(instante(fechaOperacion))),
    )!;
    const carga = {
      fecha: fechaOperacion,
      horaCarga: indice === 4 ? '14:30' : '08:30',
      maquinariaId: maquinaria.id,
      tipoCombustible: 'Diésel' as const,
      tipoCombustibleId: referencia('combustibles', 'Diésel'),
      litrosSolicitados: horas * 12 + indice * 2 + 10,
      litrosCargados: horas * 12 + indice * 2,
      operador: asignacion.operador,
      operadorId: asignacion.operadorId,
      asignacionId: asignacion.id,
      residenteId: residente.residenteId,
      nombreResidente: residente.nombre,
      pkResidente: residente.pk,
      ubicacionId: referencia('ubicaciones', residente.pk),
      numeroOrquesta: `ORQ-${String(equipo + 1).padStart(3, '0')}`,
      despachadorId: clave('despachadores', equipo % 3),
      nombreDespachador: despachadores[equipo % 3],
    };
    base.combustible.push({ ...carga, ...auditar(clave('com', indice), carga, fechaOperacion) });
  });
  base.maquinarias.forEach((maquinaria, indice) => {
    const actual =
      base.horometros.filter((lectura) => lectura.maquinariaId === maquinaria.id).at(-1)
        ?.lecturaFinal ?? maquinaria.horometroBase;
    const acumuladas = [120, 200, 250, 251, 80][indice % 5];
    for (const anterior of [true, false]) {
      const datos = {
        maquinariaId: maquinaria.id,
        fecha: dia(anterior ? -45 : -10),
        lecturaHorometro: actual - acumuladas - (anterior ? 250 : 0),
        tipoServicio: anterior ? 'Servicio anterior ficticio' : 'Preventivo ficticio de prueba',
        observaciones: 'Dato ficticio de prueba: cambio de filtros y lubricación.',
      };
      base.mantenimientos!.push({
        ...datos,
        ...auditar(clave(anterior ? 'man-anterior' : 'man', indice), datos, datos.fecha),
      });
    }
  });
  return base;
}

export function muestraActualAplicada(base: BaseDatos): boolean {
  return (['maquinarias', 'horometros', 'combustible'] as const).every((modulo) =>
    Array.from({ length: 15 }, (_, indice) =>
      clave(modulo === 'maquinarias' ? 'maq' : modulo === 'horometros' ? 'hor' : 'com', indice),
    ).every((id) =>
      base[modulo].some(
        (registro) =>
          registro.id === id &&
          registro.historial.some((cambio) => cambio.valores.versionMuestra === versionMuestra),
      ),
    ),
  );
}
export function contieneMuestraFicticia(base: BaseDatos): boolean {
  return [...base.maquinarias, ...base.horometros, ...base.combustible].some((registro) =>
    registro.historial.some((cambio) => cambio.valores.muestra === 'Dato ficticio de prueba'),
  );
}
