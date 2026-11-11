import estilos from './Interfaz.module.css';
export function CabeceraPagina({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className={estilos.cabeceraPagina}>
      <div>
        <h1>{titulo}</h1>
        <p>{descripcion}</p>
      </div>
    </div>
  );
}
