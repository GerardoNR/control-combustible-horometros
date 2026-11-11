import { useState } from 'react';
import { rutaLogotipo, rutaLogotipoOriginal } from '../recursos/logotipo';
import estilos from './Logotipo.module.css';
export function Logotipo({
  claro = false,
  compacto = false,
}: {
  claro?: boolean;
  compacto?: boolean;
}) {
  const [imagen, cambiarImagen] = useState(rutaLogotipo);
  return (
    <span className={`${estilos.logotipo} ${claro ? estilos.claro : ''}`}>
      <img
        src={imagen}
        onError={() => {
          if (imagen !== rutaLogotipoOriginal) cambiarImagen(rutaLogotipoOriginal);
        }}
        alt={compacto ? 'Control de Maquinaria' : ''}
        width={48}
        height={48}
      />
      {!compacto && <span className={estilos.nombre}>Control de Maquinaria</span>}
    </span>
  );
}
