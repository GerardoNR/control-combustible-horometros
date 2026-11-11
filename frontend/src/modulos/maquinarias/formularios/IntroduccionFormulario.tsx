import type { ReactNode } from 'react';
import estilos from './FormularioMaquinaria.module.css';

export function IntroduccionFormulario({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className={estilos.introduccion}>
      <h3>{titulo}</h3>
      <p>{children}</p>
    </div>
  );
}
