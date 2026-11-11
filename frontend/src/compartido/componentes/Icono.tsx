export function Icono({ nombre, clase = '' }: { nombre: string; clase?: string }) {
  return <i className={`bi bi-${nombre} ${clase}`} aria-hidden="true" />;
}
