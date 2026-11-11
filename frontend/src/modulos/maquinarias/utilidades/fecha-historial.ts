export function fechaLocal(fecha = new Date()): string {
  const dos = (valor: number) => String(valor).padStart(2, '0');
  return `${String(fecha.getFullYear()).padStart(4, '0')}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}
export function fechaVisible(fecha: string): string {
  return fecha.split('-').reverse().join('/');
}
export function fechaDelInstante(instante: string): string {
  const fecha = new Date(instante);
  return Number.isFinite(fecha.getTime())
    ? fechaVisible(fechaLocal(fecha))
    : 'Sin fecha registrada';
}
function leerFechaLocal(valor: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Selecciona una fecha válida.');
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(0);
  fecha.setFullYear(anio, mes - 1, dia);
  fecha.setHours(0, 0, 0, 0);
  if (fechaLocal(fecha) !== valor) throw new Error('Selecciona una fecha válida.');
  return fecha;
}
export function validarFechaConsulta(valor: string, ahora = new Date()): string {
  leerFechaLocal(valor);
  if (valor > fechaLocal(ahora)) throw new Error('Selecciona hoy o una fecha anterior.');
  return valor;
}
export function periodosDelDia<T extends { inicio: string; fin: string | null }>(
  periodos: T[],
  fecha: string,
): T[] {
  const inicio = leerFechaLocal(fecha);
  const fin = new Date(inicio);
  // Avanzar un día local también respeta los cambios de horario.
  fin.setDate(fin.getDate() + 1);
  return periodos
    .filter(
      (periodo) =>
        Date.parse(periodo.inicio) < fin.getTime() &&
        (periodo.fin === null || Date.parse(periodo.fin) > inicio.getTime()),
    )
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
}
