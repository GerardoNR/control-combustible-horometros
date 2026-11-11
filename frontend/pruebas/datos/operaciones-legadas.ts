import { valoresAuditables } from '../../src/compartido/utilidades/auditoria';
import { sumarDiasCalendario } from '../../src/modulos/maquinarias/servicios/mantenimiento';
import type { Auditoria, BaseDatos, MapaDatos } from '../../src/compartido/tipos/datos';
import { hoy } from '../../src/compartido/utilidades/formato';
export function crearDemostracion(): BaseDatos {
  const fecha = hoy();
  const auditoria = (id: string, valores: object): Auditoria => ({
    id,
    creadoEn: `${fecha}T08:00:00-06:00`,
    creadoPor: 'Ana Martínez',
    modificadoEn: `${fecha}T08:00:00-06:00`,
    modificadoPor: 'Ana Martínez',
    historial: [
      {
        fecha: `${fecha}T08:00:00-06:00`,
        usuarioId: 'usr-ana',
        usuarioNombre: 'Ana Martínez',
        accion: 'Creación',
        valores: valoresAuditables(valores),
      },
    ],
  });
  const equipos: MapaDatos['maquinarias'][] = [
    {
      numeroEconomico: 'EXC-001',
      placas: 'NL-4821-A',
      tipo: 'Excavadora',
      marca: 'Caterpillar',
      modelo: '320 GC',
      estado: 'Operativa',
      horometroBase: 2472,
    },
    {
      numeroEconomico: 'RET-002',
      placas: 'NL-7392-B',
      tipo: 'Retroexcavadora',
      marca: 'John Deere',
      modelo: '310 SL',
      estado: 'Operativa',
      horometroBase: 1856,
    },
    {
      numeroEconomico: 'MOT-003',
      placas: 'NL-2851-C',
      tipo: 'Motoniveladora',
      marca: 'Caterpillar',
      modelo: '140 K',
      estado: 'En mantenimiento',
      horometroBase: 4210,
    },
    {
      numeroEconomico: 'COM-004',
      placas: 'NL-6023-D',
      tipo: 'Compactador',
      marca: 'BOMAG',
      modelo: 'BW 211 D',
      estado: 'Operativa',
      horometroBase: 934,
    },
    {
      numeroEconomico: 'CAR-005',
      placas: 'NL-9284-E',
      tipo: 'Cargador frontal',
      marca: 'Komatsu',
      modelo: 'WA380-8',
      estado: 'Operativa',
      horometroBase: 3128,
    },
    {
      numeroEconomico: 'EXC-006',
      placas: 'NL-3857-F',
      tipo: 'Excavadora',
      marca: 'Volvo',
      modelo: 'EC220D',
      estado: 'Fuera de servicio',
      horometroBase: 5680,
    },
    {
      numeroEconomico: 'RET-007',
      placas: 'NL-8512-G',
      tipo: 'Retroexcavadora',
      marca: 'CASE',
      modelo: '580N',
      estado: 'Operativa',
      horometroBase: 1240,
    },
    {
      numeroEconomico: 'COM-008',
      placas: 'NL-1936-H',
      tipo: 'Compactador',
      marca: 'Dynapac',
      modelo: 'CA250D',
      estado: 'En mantenimiento',
      horometroBase: 2875,
    },
  ];
  const antiguedadesMantenimiento = [20, 80, 100, 35, 88, 120, 5, 75];
  const maquinarias = equipos.map((equipo, indice) => {
    const fechaUltimoMantenimiento = sumarDiasCalendario(fecha, -antiguedadesMantenimiento[indice]);
    const datos = {
      ...equipo,
      fechaUltimoMantenimiento,
      fechaProximoMantenimiento: sumarDiasCalendario(fechaUltimoMantenimiento, 90),
      observacionesMantenimiento:
        'Servicio preventivo simulado: lubricación, revisión de filtros y niveles.',
    };
    return { ...datos, ...auditoria(`maq-${indice + 1}`, datos) };
  });
  const operadores = ['José Luis García', 'Miguel Ángel López', 'Pedro Sánchez', 'Roberto Torres'];
  const ids = [1, 2, 4, 5];
  const horometros = ids.map((id, indice) => {
    const equipo = maquinarias[id - 1];
    const datos = {
      fecha,
      maquinariaId: equipo.id,
      lecturaInicial: equipo.horometroBase,
      lecturaFinal: equipo.horometroBase + 8 + indice / 2,
      fechaAsignacion: fecha,
      operador: operadores[indice],
    };
    return { ...datos, ...auditoria(`hor-${id}`, datos) };
  });
  const detallesSuministros = [
    {
      nombreResidente: 'Adriana Salazar',
      pkResidente: '012+350',
      numeroOrquesta: 'ORQ-001',
      nombreDespachador: 'Arturo Pérez',
    },
    {
      nombreResidente: 'Verónica Castillo',
      pkResidente: '014+800',
      numeroOrquesta: 'ORQ-002',
      nombreDespachador: 'Sofía Medina',
    },
    {
      nombreResidente: 'Daniela Morales',
      pkResidente: '021+000',
      numeroOrquesta: 'ORQ-003',
      nombreDespachador: 'Arturo Pérez',
    },
    {
      nombreResidente: 'Jorge Vázquez',
      pkResidente: '026+150',
      numeroOrquesta: 'ORQ-004',
      nombreDespachador: 'Sofía Medina',
    },
  ];
  const combustible = ids.map((id, indice) => {
    const datos: MapaDatos['combustible'] = {
      ...detallesSuministros[indice],
      fecha,
      maquinariaId: `maq-${id}`,
      litrosSolicitados: 100 + indice * 20,
      litrosCargados: 95 + indice * 20,
      tipoCombustible: 'Diésel',
      operador: operadores[indice],
      horaCarga: `0${6 + indice}:30`,
    };
    return { ...datos, ...auditoria(`com-${id}`, datos) };
  });
  const actividades = [
    'Excavación · Frente norte',
    'Zanja sanitaria · Sector B',
    'Compactación · Plataforma 2',
    'Carga de material · Banco 1',
  ];
  const operaciones = ids.map((id, indice) => {
    const datos = {
      fecha,
      maquinariaId: `maq-${id}`,
      actividad: actividades[indice],
      operador: operadores[indice],
    };
    return { ...datos, ...auditoria(`ope-${id}`, datos) };
  });
  const mantenimientos = maquinarias.slice(0, 4).map((equipo, indice) => {
    const datos = {
      maquinariaId: equipo.id,
      fecha: equipo.fechaUltimoMantenimiento,
      lecturaHorometro: equipo.horometroBase - [100, 210, 250, 260][indice],
      tipoServicio: 'Preventivo simulado',
      observaciones: 'Servicio de demostración con lectura conocida.',
    };
    return { ...datos, ...auditoria(`man-${indice + 1}`, datos) };
  });
  return { maquinarias, horometros, combustible, mantenimientos, 'control-diario': operaciones };
}
