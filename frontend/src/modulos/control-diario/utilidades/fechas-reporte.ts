// Zona de la obra; el reporte no depende de la zona del equipo que lo genera.
export const zonaOperativa = 'America/Monterrey';
const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: zonaOperativa,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
function calendarioEnZona(instante: number) {
  const partes = Object.fromEntries(
    formato.formatToParts(new Date(instante)).map((parte) => [parte.type, parte.value]),
  );
  return Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );
}
export function limitesDiaOperativo(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  function medianoche(objetivo: number) {
    let instante = objetivo;
    for (let intento = 0; intento < 3; intento++) {
      const ajuste = objetivo - calendarioEnZona(instante);
      instante += ajuste;
      if (!ajuste) break;
    }
    return instante;
  }
  return {
    inicio: medianoche(Date.UTC(anio, mes - 1, dia)),
    fin: medianoche(Date.UTC(anio, mes - 1, dia + 1)),
  };
}
export const horaOperativa = (instante: number) =>
  new Intl.DateTimeFormat('es-MX', {
    timeZone: zonaOperativa,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instante));
export const fechaGeneracion = (fecha: Date) =>
  new Intl.DateTimeFormat('es-MX', {
    timeZone: zonaOperativa,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
// Excel no almacena zona horaria: se conserva la fecha y hora civil de la obra.
export const fechaGeneracionExcel = (fecha: Date) => new Date(calendarioEnZona(fecha.getTime()));
