export const numero = (valor: number, decimales = 1) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: decimales }).format(valor);
export const fechaCorta = (valor: string) =>
  new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(`${valor}T12:00:00`),
  );
export const fechaHora = (valor: string) =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(valor),
  );
export function fechaCalendario(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}
export const hoy = () => fechaCalendario(new Date());
export const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
